const KEYRING_SERVICE = 'qasphere-cli'
const KEYRING_ACCOUNT = 'credentials'

export interface KeyringEntry {
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

export async function getKeyringEntry(): Promise<KeyringEntry | null> {
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
