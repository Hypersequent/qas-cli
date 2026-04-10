import type { Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { ensureInteractive, prompt } from '../utils/prompt'
import { openBrowser } from '../utils/browser'
import { twirlLoader } from '../utils/misc'
import {
	saveCredentials,
	clearCredentials,
	resolveCredentialSource,
	resolvePersistedCredentialSource,
	refreshIfNeeded,
	type CredentialSource,
} from '../utils/credentials'
import { createApi } from '../api'
import {
	checkTenant,
	requestDeviceCode,
	pollDeviceToken,
	type OAuthDeviceCodeResponse,
} from '../api/oauth'

async function resolveTenantUrl(): Promise<string> {
	const teamName = await prompt('Team name: ')
	if (!teamName) {
		console.error(chalk.red('Error:') + ' Team name is required.')
		process.exit(1)
	}

	try {
		const { tenantUrl, suspended } = await checkTenant(teamName)
		if (suspended) {
			console.error(chalk.red('Error:') + ` Team "${teamName}" has been suspended.`)
			process.exit(1)
		}
		return tenantUrl
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Could not find team "${teamName}": ${message}`)
		process.exit(1)
	}
}

/**
 * OAuth 2.0 Device Authorization Grant flow (RFC 8628).
 *
 * 1. CLI requests a device code and user code from the tenant backend.
 * 2. CLI opens the browser to the verification URL (with pre-filled code).
 * 3. The user approves the device in the browser.
 * 4. CLI polls the token endpoint until the user approves or the code expires.
 * 5. On approval, the backend returns access + refresh tokens which the CLI stores.
 */
async function handleDeviceLogin(): Promise<void> {
	const tenantUrl = await resolveTenantUrl()

	let deviceCodeResponse: OAuthDeviceCodeResponse
	try {
		deviceCodeResponse = await requestDeviceCode(tenantUrl)
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Failed to start login flow: ${message}`)
		process.exit(1)
	}

	const { device_code, user_code, verification_uri, verification_uri_complete, expires_in } =
		deviceCodeResponse
	let currentInterval = deviceCodeResponse.interval

	console.log('Opening browser to authorize...')
	const normalizedCode = user_code.replace('-', '')
	const url = verification_uri_complete || `${verification_uri}?code=${normalizedCode}`
	console.log(`\nIf the browser didn't open, visit:\n  ${url}\n`)
	openBrowser(url)
	console.log(`Verify the code displayed in the browser: ${chalk.bold(normalizedCode)}\n`)

	const loader = twirlLoader()
	loader.start('Waiting for authorization...')

	// Handle Ctrl+C gracefully during polling
	const onSigint = () => {
		loader.stop()
		console.log('Cancelled.')
		process.exit(0)
	}
	process.on('SIGINT', onSigint)

	const deadline = Date.now() + expires_in * 1000

	try {
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, currentInterval * 1000))

			const result = await pollDeviceToken(tenantUrl, device_code)

			if (result.ok) {
				loader.stop()
				process.removeListener('SIGINT', onSigint)

				const source = await saveCredentials({
					type: 'oauth',
					accessToken: result.data.access_token,
					refreshToken: result.data.refresh_token,
					accessTokenExpiresAt: new Date(Date.now() + result.data.expires_in * 1000).toISOString(),
					tenantUrl,
				})

				console.log(chalk.green('\u2713') + ` Logged in to ${tenantUrl}`)
				console.log(`  Credentials saved to ${source}.`)
				return
			}

			// Handle OAuth error responses
			switch (result.error.error) {
				case 'authorization_pending':
					// Keep polling
					break
				case 'slow_down':
					currentInterval += 5
					break
				case 'access_denied':
					loader.stop()
					process.removeListener('SIGINT', onSigint)
					console.error(chalk.red('\u2717') + ' Authorization denied by user.')
					process.exit(1)
					break // unreachable, but satisfies linter
				case 'expired_token':
					loader.stop()
					process.removeListener('SIGINT', onSigint)
					console.error(chalk.red('\u2717') + ' Authorization timed out. Please try again.')
					process.exit(1)
					break // unreachable
				default:
					loader.stop()
					process.removeListener('SIGINT', onSigint)
					console.error(
						chalk.red('Error:') +
							` Authorization failed: ${result.error.error_description || result.error.error}`
					)
					process.exit(1)
			}
		}

		loader.stop()
		console.error(chalk.red('\u2717') + ' Authorization timed out. Please try again.')
		process.exit(1)
	} catch (e) {
		loader.stop()
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Authorization failed: ${message}`)
		process.exit(1)
	}
}

async function handleStatus(): Promise<void> {
	let result = await resolveCredentialSource()
	if (!result) {
		console.log('Not logged in.')
		return
	}

	// Refresh OAuth tokens if expired before validating
	if (result.authType === 'bearer') {
		result = await refreshIfNeeded(result)
	}

	const tenantUrl = result.authType === 'bearer' ? result.credentials.tenantUrl : result.tenantUrl
	console.log(`Logged in to ${tenantUrl}`)
	console.log(`  Source: ${result.source}`)

	const token = result.authType === 'bearer' ? result.credentials.accessToken : result.token
	try {
		const api = createApi(tenantUrl, token, result.authType)
		await api.projects.listProjects()
		console.log(`  Status: ${chalk.green('valid')}`)
	} catch {
		console.log(`  Status: ${chalk.red('invalid or expired')}`)
	}

	if (result.authType === 'bearer') {
		const expiresAt = new Date(result.credentials.accessTokenExpiresAt)
		const remainingMs = expiresAt.getTime() - Date.now()
		if (remainingMs > 0) {
			const minutes = Math.floor(remainingMs / 60_000)
			console.log(`  Access token expires: in ${minutes} minute${minutes !== 1 ? 's' : ''}`)
		} else {
			console.log(`  Access token expires: ${chalk.yellow('expired (will refresh on next use)')}`)
		}
	}
}

const sourceLabels: Partial<Record<CredentialSource, string>> = {
	env_var: 'environment variables (QAS_TOKEN, QAS_URL)',
	'.env': 'a .env file in the current directory',
	'.qaspherecli': 'a .qaspherecli file',
}

async function handleLogout(): Promise<void> {
	const clearableSource = await resolvePersistedCredentialSource()

	if (clearableSource) {
		try {
			await clearCredentials(clearableSource.source)
		} catch (e) {
			const message = e instanceof Error ? e.message : String(e)
			console.error(
				chalk.red('Error:') +
					` Could not clear credentials from ${clearableSource.source}: ${message}`
			)
			process.exit(1)
		}
		console.log('Logged out.')

		// Warn if credentials are still available from another source
		const remaining = await resolveCredentialSource()
		if (remaining) {
			const label = sourceLabels[remaining.source] || remaining.source
			console.log(`Note: credentials are still available via ${label}.`)
		}

		console.log(
			'Note: your authorization is still active on the server. To revoke it, visit your QA Sphere account settings.'
		)
		return
	}

	// No clearable source — check if credentials come from a non-clearable source
	const source = await resolveCredentialSource()
	if (source) {
		const label = sourceLabels[source.source] || source.source
		console.log(`Cannot log out: credentials are provided via ${label}.`)
		console.log('Remove them manually to log out.')
		return
	}

	console.log('Not logged in.')
}

export const authCommand: CommandModule = {
	command: 'auth',
	describe: 'Manage authentication',
	builder: (yargs: Argv) =>
		yargs
			.command({
				command: 'login',
				describe: 'Authenticate with QA Sphere',
				handler: async () => {
					ensureInteractive()
					await handleDeviceLogin()
				},
			})
			.command({
				command: 'status',
				describe: 'Show current authentication status',
				handler: async () => {
					await handleStatus()
				},
			})
			.command({
				command: 'logout',
				describe: 'Clear stored credentials',
				handler: async () => {
					await handleLogout()
				},
			})
			.demandCommand(1, ''),
	handler: () => {},
}
