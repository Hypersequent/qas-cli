import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const KEYRING_SERVICE = 'qasphere-cli'
const KEYRING_ACCOUNT = 'credentials'
const CONFIG_DIR = join(homedir(), '.config', 'qasphere')
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json')

export interface StoredCredentials {
	apiKey: string
	tenantUrl: string
}

export type CredentialSource = 'env_var' | '.env' | 'keyring' | 'credentials.json' | '.qaspherecli'

interface KeyringEntry {
	setPassword(password: string): void
	getPassword(): string
	deletePassword(): void
}

type KeyringModule = {
	Entry: new (service: string, account: string) => KeyringEntry
}

async function loadKeyringModule(): Promise<KeyringModule | null> {
	try {
		return (await import('@napi-rs/keyring')) as KeyringModule
	} catch {
		// Import fails when the native binary is missing (e.g., Alpine/musl where
		// the platform-specific @napi-rs/keyring-* package is not installed).
		return null
	}
}

async function getKeyringEntry(): Promise<KeyringEntry | null> {
	const mod = await loadKeyringModule()
	if (!mod) return null
	try {
		return new mod.Entry(KEYRING_SERVICE, KEYRING_ACCOUNT)
	} catch {
		// Entry construction fails when the keyring daemon is unavailable
		// (e.g., glibc Linux without D-Bus/Secret Service).
		return null
	}
}

export async function saveCredentials(credentials: StoredCredentials): Promise<CredentialSource> {
	const json = JSON.stringify(credentials)

	const entry = await getKeyringEntry()
	if (entry) {
		try {
			entry.setPassword(json)
			return 'keyring'
		} catch {
			// Keyring operation failed, fall through to file
		}
	}

	// Fallback: write to file with restricted permissions
	mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 })
	writeFileSync(CREDENTIALS_FILE, json, { encoding: 'utf-8', mode: 0o600 })
	chmodSync(CREDENTIALS_FILE, 0o600) // belt-and-suspenders for existing files
	return 'credentials.json'
}

function isValidCredentials(obj: unknown): obj is StoredCredentials {
	return (
		typeof obj === 'object' &&
		obj !== null &&
		typeof (obj as StoredCredentials).apiKey === 'string' &&
		typeof (obj as StoredCredentials).tenantUrl === 'string'
	)
}

export async function loadCredentialsFromKeyring(): Promise<StoredCredentials | null> {
	const entry = await getKeyringEntry()
	if (!entry) return null

	try {
		const json = entry.getPassword()
		const parsed: unknown = JSON.parse(json)
		return isValidCredentials(parsed) ? parsed : null
	} catch {
		// Operations fail when the keyring daemon is unavailable
		// (e.g., glibc Linux without D-Bus/Secret Service).
		return null
	}
}

export function loadCredentialsFromFile(): StoredCredentials | null {
	if (!existsSync(CREDENTIALS_FILE)) return null

	try {
		const json = readFileSync(CREDENTIALS_FILE, 'utf-8')
		const parsed: unknown = JSON.parse(json)
		if (!isValidCredentials(parsed)) {
			console.warn(`Warning: credentials file at ${CREDENTIALS_FILE} has invalid format.`)
			return null
		}
		return parsed
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e)
		console.warn(`Warning: could not read credentials file at ${CREDENTIALS_FILE}: ${message}`)
		return null
	}
}

export async function clearCredentials(): Promise<{
	cleared: boolean
	source?: CredentialSource
}> {
	// Try keyring first
	const entry = await getKeyringEntry()
	if (entry) {
		try {
			entry.getPassword() // Throws if no entry exists
			entry.deletePassword()
			return { cleared: true, source: 'keyring' }
		} catch {
			// No keyring entry or keyring unavailable, continue to file
		}
	}

	// Try file
	if (existsSync(CREDENTIALS_FILE)) {
		unlinkSync(CREDENTIALS_FILE)
		return { cleared: true, source: 'credentials.json' }
	}

	return { cleared: false }
}
