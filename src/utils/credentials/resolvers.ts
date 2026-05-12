import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import type { DotenvPopulateInput } from 'dotenv'
import chalk from 'chalk'
import { refreshAccessToken, OAuthProtocolError } from '../../api/oauth'
import {
	saveCredentials,
	clearCredentials,
	loadCredentialsFromKeyring,
	loadCredentialsFromFile,
} from './storage'
import type {
	OAuthCredentials,
	ApiKeyResolved,
	OAuthResolved,
	ResolvedCredentials,
	AuthConfig,
} from './types'

export const qasEnvFile = '.qaspherecli'
export const qasEnvs = ['QAS_TOKEN', 'QAS_URL']

const REFRESH_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

const normalizeTenantUrl = (url: string) => url.replace(/\/+$/, '')

interface ResolveResult {
	credentials: ApiKeyResolved | null
	errorMessage?: string
}

function partialConfigMessage(
	sourceLabel: string,
	hasToken: boolean,
	hasUrl: boolean
): string | undefined {
	if (hasToken === hasUrl) return undefined
	const missing = hasToken ? 'QAS_URL' : 'QAS_TOKEN'
	const present = hasToken ? 'QAS_TOKEN' : 'QAS_URL'
	return `${sourceLabel}: ${present} is set but ${missing} is missing — skipping.`
}

function resolveFromEnvVars(): ResolveResult {
	const token = process.env.QAS_TOKEN
	const url = process.env.QAS_URL
	if (token && url) {
		return {
			credentials: {
				token,
				tenantUrl: normalizeTenantUrl(url),
				authType: 'apikey',
				source: 'env_var',
			},
		}
	}
	return {
		credentials: null,
		errorMessage: partialConfigMessage('Environment variables', !!token, !!url),
	}
}

function resolveFromDotenv(): ResolveResult {
	const dotenvPath = join(process.cwd(), '.env')
	if (!existsSync(dotenvPath)) return { credentials: null }

	const fileEnvs: DotenvPopulateInput = {}
	config({ path: dotenvPath, processEnv: fileEnvs })
	const token = fileEnvs.QAS_TOKEN
	const url = fileEnvs.QAS_URL
	if (token && url) {
		return {
			credentials: {
				token,
				tenantUrl: normalizeTenantUrl(url),
				authType: 'apikey',
				source: '.env',
			},
		}
	}
	return {
		credentials: null,
		errorMessage: partialConfigMessage(`.env file at ${dotenvPath}`, !!token, !!url),
	}
}

function resolveFromQaspherecli(): ResolveResult {
	let dir = process.cwd()
	for (;;) {
		const envPath = join(dir, qasEnvFile)
		if (existsSync(envPath)) {
			const fileEnvs: DotenvPopulateInput = {}
			config({ path: envPath, processEnv: fileEnvs })
			const token = fileEnvs.QAS_TOKEN
			const url = fileEnvs.QAS_URL
			if (token && url) {
				return {
					credentials: {
						token,
						tenantUrl: normalizeTenantUrl(url),
						authType: 'apikey',
						source: '.qaspherecli',
					},
				}
			}
			return {
				credentials: null,
				errorMessage: partialConfigMessage(`.qaspherecli at ${envPath}`, !!token, !!url),
			}
		}

		const parentDir = dirname(dir)
		if (parentDir === dir) break
		dir = parentDir
	}
	return { credentials: null }
}

function warnIfHasError(result: ResolveResult): void {
	if (result.errorMessage) {
		console.warn(chalk.yellow('Warning:') + ` ${result.errorMessage}`)
	}
}

export async function resolvePersistedCredentialSource(): Promise<OAuthResolved | null> {
	const keyringCreds = await loadCredentialsFromKeyring()
	if (keyringCreds) {
		return { credentials: keyringCreds, authType: 'bearer', source: 'keyring' }
	}

	const fileCreds = loadCredentialsFromFile()
	if (fileCreds) {
		return { credentials: fileCreds, authType: 'bearer', source: 'credentials.json' }
	}
	return null
}

/**
 * Resolves the credential source without modifying process.env.
 * Used by auth status/logout to report where credentials come from.
 */
export async function resolveCredentialSource(): Promise<ResolvedCredentials | null> {
	// 1. Environment variables
	const envResult = resolveFromEnvVars()
	if (envResult.credentials) return envResult.credentials
	warnIfHasError(envResult)

	// 2. .env file in cwd
	const dotenvResult = resolveFromDotenv()
	if (dotenvResult.credentials) return dotenvResult.credentials
	warnIfHasError(dotenvResult)

	// 3. Keyring or credentials.json (OAuth only)
	const persisted = await resolvePersistedCredentialSource()
	if (persisted) return persisted

	// 4. .qaspherecli file
	const cliResult = resolveFromQaspherecli()
	warnIfHasError(cliResult)
	return cliResult.credentials
}

export async function refreshIfNeeded(resolved: OAuthResolved): Promise<OAuthResolved> {
	const expiresAt = new Date(resolved.credentials.accessTokenExpiresAt).getTime()
	if (expiresAt - Date.now() >= REFRESH_THRESHOLD_MS) {
		return resolved
	}

	try {
		const tokenResponse = await refreshAccessToken(
			resolved.credentials.tenantUrl,
			resolved.credentials.refreshToken
		)

		const updated: OAuthCredentials = {
			type: 'oauth',
			accessToken: tokenResponse.access_token,
			refreshToken: tokenResponse.refresh_token,
			accessTokenExpiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString(),
			refreshTokenExpiresAt: new Date(
				Date.now() + tokenResponse.refresh_token_expires_in * 1000
			).toISOString(),
			tenantUrl: resolved.credentials.tenantUrl,
		}

		const newSource = await saveCredentials(updated)
		return { credentials: updated, authType: 'bearer', source: newSource }
	} catch (e) {
		if (e instanceof OAuthProtocolError) {
			// Protocol-level rejection (e.g., invalid_grant) — credentials are no longer
			// valid; clear them and ask the user to re-authenticate.
			try {
				await clearCredentials(resolved.source)
			} catch (clearErr) {
				const msg = clearErr instanceof Error ? clearErr.message : String(clearErr)
				console.warn(chalk.yellow('Warning:') + ` could not clear stale credentials: ${msg}`)
			}

			console.error(chalk.red('Session expired.') + ' Please log in again:')
			console.error(chalk.green('  qasphere auth login'))
			process.exit(1)
		}

		// Transport error (network failure, 5xx, malformed payload). Do NOT clear
		// credentials — they may still be valid; the failure is upstream.
		const message = e instanceof Error ? e.message : String(e)
		console.error(chalk.red('Could not refresh session:') + ` ${message}. Please try again later.`)
		process.exit(1)
	}
}

export async function resolveAuth(): Promise<AuthConfig> {
	const resolved = await resolveCredentialSource()
	if (!resolved) {
		console.error(chalk.red('Not authenticated.'))
		console.error('\nYou can authenticate using:')
		console.error(chalk.green('  qasphere auth login'))
		console.error('\nOr create a .qaspherecli file with the following content:')
		console.error(
			chalk.green(`
QAS_TOKEN=your_token
QAS_URL=http://your-qasphere-instance-url

# Example:
# QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
# QAS_URL=https://tenant_id.eu1.qasphere.com`)
		)
		console.error('\nOr export them as environment variables:')
		console.error(
			chalk.green(`
export QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
export QAS_URL=https://tenant_id.eu1.qasphere.com`)
		)
		process.exit(1)
	}

	if (resolved.authType === 'bearer') {
		const refreshed = await refreshIfNeeded(resolved)
		return {
			token: refreshed.credentials.accessToken,
			baseUrl: refreshed.credentials.tenantUrl,
			authType: 'bearer',
		}
	}

	return {
		token: resolved.token,
		baseUrl: resolved.tenantUrl,
		authType: 'apikey',
	}
}
