import { config, DotenvPopulateInput } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import chalk from 'chalk'
import {
	loadCredentialsFromKeyring,
	loadCredentialsFromFile,
	type StoredCredentials,
	type CredentialSource,
} from './credentials'

export const qasEnvFile = '.qaspherecli'
export const qasEnvs = ['QAS_TOKEN', 'QAS_URL']

interface ResolvedCredentials {
	credentials: StoredCredentials
	source: CredentialSource
}

/**
 * Resolves the credential source without modifying process.env.
 * Used by auth status/logout to report where credentials come from.
 */
export async function resolveCredentialSource(): Promise<ResolvedCredentials | null> {
	// 1. Environment variables
	if (process.env.QAS_TOKEN && process.env.QAS_URL) {
		return {
			credentials: { apiKey: process.env.QAS_TOKEN, tenantUrl: process.env.QAS_URL },
			source: 'env_var',
		}
	}

	// 2. .env file in cwd
	const dotenvPath = join(process.cwd(), '.env')
	if (existsSync(dotenvPath)) {
		const fileEnvs: DotenvPopulateInput = {}
		config({ path: dotenvPath, processEnv: fileEnvs })
		if (fileEnvs.QAS_TOKEN && fileEnvs.QAS_URL) {
			return {
				credentials: {
					apiKey: fileEnvs.QAS_TOKEN,
					tenantUrl: fileEnvs.QAS_URL,
				},
				source: '.env',
			}
		}
	}

	// 3. Keyring
	const keyringCreds = await loadCredentialsFromKeyring()
	if (keyringCreds) {
		return { credentials: keyringCreds, source: 'keyring' }
	}

	// 4. ~/.config/qasphere/credentials.json
	const fileCreds = loadCredentialsFromFile()
	if (fileCreds) {
		return { credentials: fileCreds, source: 'credentials.json' }
	}

	// 5. .qaspherecli file
	let dir = process.cwd()
	for (;;) {
		const envPath = join(dir, qasEnvFile)
		if (existsSync(envPath)) {
			const fileEnvs: DotenvPopulateInput = {}
			config({ path: envPath, processEnv: fileEnvs })
			if (fileEnvs.QAS_TOKEN && fileEnvs.QAS_URL) {
				return {
					credentials: {
						apiKey: fileEnvs.QAS_TOKEN,
						tenantUrl: fileEnvs.QAS_URL,
					},
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

export async function loadEnvs(): Promise<void> {
	const resolved = await resolveCredentialSource()
	if (resolved) {
		process.env.QAS_TOKEN = resolved.credentials.apiKey
		process.env.QAS_URL = resolved.credentials.tenantUrl
		return
	}

	console.log(
		chalk.red('Missing required environment variables: ') +
			qasEnvs.filter((k) => !process.env[k]).join(', ')
	)
	console.log('\nYou can authenticate using:')
	console.log(chalk.green('  qasphere auth login'))
	console.log('\nOr create a .qaspherecli file with the following content:')
	console.log(
		chalk.green(`
QAS_TOKEN=your_token
QAS_URL=http://your-qasphere-instance-url

# Example:
# QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
# QAS_URL=http://tenant1.localhost:5173`)
	)
	console.log('\nOr export them as environment variables:')
	console.log(
		chalk.green(`
export QAS_TOKEN=your_token
export QAS_URL=http://your-qasphere-instance-url`)
	)
	process.exit(1)
}
