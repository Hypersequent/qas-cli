import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { config } from 'dotenv'
import type { DotenvPopulateInput } from 'dotenv'
import chalk from 'chalk'
import { refreshAccessToken } from '../../api/oauth'
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

function resolveFromEnvVars(): ApiKeyResolved | null {
	if (process.env.QAS_TOKEN && process.env.QAS_URL) {
		return {
			token: process.env.QAS_TOKEN,
			tenantUrl: process.env.QAS_URL,
			authType: 'apikey',
			source: 'env_var',
		}
	}
	return null
}

function resolveFromDotenv(): ApiKeyResolved | null {
	const dotenvPath = join(process.cwd(), '.env')
	if (!existsSync(dotenvPath)) return null

	const fileEnvs: DotenvPopulateInput = {}
	config({ path: dotenvPath, processEnv: fileEnvs })
	if (fileEnvs.QAS_TOKEN && fileEnvs.QAS_URL) {
		return {
			token: fileEnvs.QAS_TOKEN,
			tenantUrl: fileEnvs.QAS_URL,
			authType: 'apikey',
			source: '.env',
		}
	}
	return null
}

function resolveFromQaspherecli(): ApiKeyResolved | null {
	let dir = process.cwd()
	for (;;) {
		const envPath = join(dir, qasEnvFile)
		if (existsSync(envPath)) {
			const fileEnvs: DotenvPopulateInput = {}
			config({ path: envPath, processEnv: fileEnvs })
			if (fileEnvs.QAS_TOKEN && fileEnvs.QAS_URL) {
				return {
					token: fileEnvs.QAS_TOKEN,
					tenantUrl: fileEnvs.QAS_URL,
					authType: 'apikey',
					source: '.qaspherecli',
				}
			}
			break
		}

		const parentDir = dirname(dir)
		if (parentDir === dir) break
		dir = parentDir
	}
	return null
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
	if (envResult) return envResult

	// 2. .env file in cwd
	const dotenvResult = resolveFromDotenv()
	if (dotenvResult) return dotenvResult

	// 3. Keyring or credentials.json (OAuth only)
	const persisted = await resolvePersistedCredentialSource()
	if (persisted) return persisted

	// 4. .qaspherecli file
	return resolveFromQaspherecli()
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
			tenantUrl: resolved.credentials.tenantUrl,
		}

		const newSource = await saveCredentials(updated)
		return { credentials: updated, authType: 'bearer', source: newSource }
	} catch {
		// Refresh failed — clear stale credentials and tell user to re-login
		try {
			await clearCredentials(resolved.source)
		} catch {
			// Ignore clear errors
		}

		console.error(chalk.red('Session expired.') + ' Please log in again:')
		console.error(chalk.green('  qasphere auth login'))
		process.exit(1)
	}
}

export async function resolveAuth(): Promise<AuthConfig> {
	const resolved = await resolveCredentialSource()
	if (!resolved) {
		console.error(
			chalk.red('Missing required environment variables: ') +
				qasEnvs.filter((k) => !process.env[k]).join(', ')
		)
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
