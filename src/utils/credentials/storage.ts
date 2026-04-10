import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { getKeyringEntry } from './keyring'
import { oauthCredentialsSchema, type OAuthCredentials, type CredentialSource } from './types'

const CONFIG_DIR = join(homedir(), '.config', 'qasphere')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

export async function saveCredentials(credentials: OAuthCredentials): Promise<CredentialSource> {
	const json = JSON.stringify(credentials)

	const entry = await getKeyringEntry()
	if (entry) {
		try {
			entry.setPassword(json)
			return 'keyring'
		} catch {
			console.warn('Warning: system keyring is not available, saving credentials to file instead.')
		}
	}

	// Fallback: write to file with restricted permissions
	mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
	writeFileSync(CREDENTIALS_FILE, json, { encoding: 'utf-8', mode: 0o600 })
	chmodSync(CREDENTIALS_FILE, 0o600) // belt-and-suspenders for existing files
	return 'credentials.json'
}

function parseOAuthCredentials(obj: unknown): OAuthCredentials | null {
	const result = oauthCredentialsSchema.safeParse(obj)
	return result.success ? result.data : null
}

export async function loadCredentialsFromKeyring(): Promise<OAuthCredentials | null> {
	const entry = await getKeyringEntry()
	if (!entry) return null

	try {
		const json = entry.getPassword()
		return parseOAuthCredentials(JSON.parse(json))
	} catch {
		// Operations fail when the keyring daemon is unavailable
		// (e.g., glibc Linux without D-Bus/Secret Service).
		return null
	}
}

export function loadCredentialsFromFile(): OAuthCredentials | null {
	if (!existsSync(CREDENTIALS_FILE)) return null

	try {
		const json = readFileSync(CREDENTIALS_FILE, 'utf-8')
		const creds = parseOAuthCredentials(JSON.parse(json))
		if (!creds) {
			console.warn(`Warning: credentials file at ${CREDENTIALS_FILE} has invalid format.`)
			return null
		}
		return creds
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.warn(`Warning: could not read credentials file at ${CREDENTIALS_FILE}: ${message}`)
		return null
	}
}

export async function clearCredentials(source: CredentialSource): Promise<void> {
	if (source === 'keyring') {
		const entry = await getKeyringEntry()
		if (!entry) throw new Error('Keyring is not available')
		entry.deletePassword()
		return
	} else if (source === 'credentials.json') {
		unlinkSync(CREDENTIALS_FILE)
		return
	}
	throw new Error(`Cannot clear credentials from ${source}`)
}
