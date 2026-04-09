import type { Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { ensureInteractive, prompt, promptHidden } from '../utils/prompt'
import { openBrowser } from '../utils/browser'
import { twirlLoader } from '../utils/misc'
import { saveCredentials, clearCredentials, type CredentialSource } from '../utils/credentials'
import { createApi } from '../api'
import {
	checkTenant,
	requestDeviceCode,
	pollDeviceToken,
	type DeviceCodeResponse,
} from '../api/deviceAuth'
import { resolveCredentialSource, resolvePersistedCredentialSource } from '../utils/env'

interface AuthLoginArgs {
	'api-key'?: boolean
}

async function resolveTenantUrl(): Promise<string> {
	const teamName = await prompt('Team name: ')
	if (!teamName) {
		console.error(chalk.red('Error:') + ' Team name is required.')
		process.exit(1)
	}

	try {
		const { tenantUrl } = await checkTenant(teamName)
		return tenantUrl
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Could not find team "${teamName}": ${message}`)
		process.exit(1)
	}
}

async function validateApiKey(tenantUrl: string, apiKey: string): Promise<boolean> {
	try {
		const api = createApi(tenantUrl, apiKey)
		await api.projects.listProjects()
		return true
	} catch {
		return false
	}
}

async function handleApiKeyLogin(): Promise<void> {
	const tenantUrl = await resolveTenantUrl()
	const apiKey = await promptHidden(`API Key ${chalk.gray('(Input Hidden)')}: `)
	if (!apiKey) {
		console.error(chalk.red('Error:') + ' API key is required.')
		process.exit(1)
	}

	if (!(await validateApiKey(tenantUrl, apiKey))) {
		console.error(chalk.red('Error:') + ' Invalid API key.')
		process.exit(1)
	}

	const source = await saveCredentials({ apiKey: apiKey, tenantUrl: tenantUrl })
	console.log(chalk.green('✓') + ` Logged in to ${tenantUrl}`)
	console.log(`  Credentials saved to ${source}.`)
}

/**
 * Device Authorization Grant flow (RFC 8628).
 *
 * 1. CLI requests a device code and user code from the tenant backend.
 * 2. CLI displays the user code and opens the browser to the verification URL.
 * 3. The user enters the code in the browser and approves the device.
 * 4. CLI polls the tenant backend until the user approves or the code expires.
 * 5. On approval, the backend returns an API key which the CLI stores.
 */
async function handleDeviceLogin(): Promise<void> {
	const tenantUrl = await resolveTenantUrl()

	let deviceCodeResponse: DeviceCodeResponse
	try {
		deviceCodeResponse = await requestDeviceCode(tenantUrl)
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Failed to start login flow: ${message}`)
		process.exit(1)
	}

	const { userCode, deviceCode, expiresIn, interval } = deviceCodeResponse

	const verificationUrl = `${tenantUrl}/login/device`
	console.log(`Opening browser at ${verificationUrl}`)
	const formattedCode =
		userCode.length === 8 ? `${userCode.slice(0, 4)}-${userCode.slice(4)}` : userCode
	console.log(`\nEnter code: ${chalk.bold(formattedCode)}\n`)
	openBrowser(verificationUrl)

	const loader = twirlLoader()
	loader.start('Waiting for authorization...')

	// Handle Ctrl+C gracefully during polling
	const onSigint = () => {
		loader.stop()
		console.log('Cancelled.')
		process.exit(0)
	}
	process.on('SIGINT', onSigint)

	const deadline = Date.now() + expiresIn * 1000

	try {
		while (Date.now() < deadline) {
			await new Promise((resolve) => setTimeout(resolve, interval * 1000))

			const result = await pollDeviceToken(tenantUrl, deviceCode)
			if (result.status === 'approved') {
				loader.stop()
				process.removeListener('SIGINT', onSigint)

				const source = await saveCredentials({
					apiKey: result.data.key,
					tenantUrl: result.data.tenantUrl,
				})

				console.log(chalk.green('✓') + ` Logged in to ${result.data.tenantUrl}`)
				console.log(`  API Key: ${result.data.keyName}`)
				console.log(`  Credentials saved to ${source}.`)
				return
			}
		}

		loader.stop()
		console.error(chalk.red('✗') + ' Authorization timed out. Please try again.')
		process.exit(1)
	} catch (e) {
		loader.stop()
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Error:') + ` Authorization failed: ${message}`)
		process.exit(1)
	}
}

async function handleStatus(): Promise<void> {
	const result = await resolveCredentialSource()
	if (!result) {
		console.log('Not logged in.')
		return
	}

	console.log(`Logged in to ${result.credentials.tenantUrl}`)
	console.log(`  Source: ${result.source}`)

	const valid = await validateApiKey(result.credentials.tenantUrl, result.credentials.apiKey)
	console.log(`  Status: ${valid ? chalk.green('valid') : chalk.red('invalid or expired')}`)
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
			'Note that your API keys are still valid. To prevent unauthorized access, revoke them in your QA Sphere account settings.'
		)
		return
	}

	// No clearable source — check if credentials come from a non-clearable source
	const source = await resolveCredentialSource()
	if (source) {
		const label = sourceLabels[source.source] || source.source
		console.log(`Cannot log out: credentials are provided via ${label}.`)
		console.log('Remove them manually to log out.')
		console.log(
			'Note that your API keys are still valid. To prevent unauthorized access, revoke them in your QA Sphere account settings.'
		)
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
				builder: (yargs: Argv) =>
					yargs.option('api-key', {
						type: 'boolean',
						describe: 'Log in by entering an API key directly',
					}),
				handler: async (args: AuthLoginArgs) => {
					ensureInteractive()
					if (args['api-key']) {
						await handleApiKeyLogin()
					} else {
						await handleDeviceLogin()
					}
				},
			} as CommandModule<object, AuthLoginArgs>)
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
