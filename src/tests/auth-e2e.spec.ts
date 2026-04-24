import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

const loginServiceUrl = 'https://login.qasphere.com'
const tenantUrl = 'https://acme.eu1.qasphere.com'
const testApiKey = 'tenantId.keyId.keyToken'
const testAccessToken = 'tenantId.authId7chars.randomAccessToken'
const testRefreshToken = 'tenantId.authId7chars.randomRefreshToken'

// --- MSW handlers ---

const checkTenantHandler = http.get(`${loginServiceUrl}/api/check-tenant`, ({ request }) => {
	const url = new URL(request.url)
	const name = url.searchParams.get('name')
	if (!name || name === 'nonexistent') {
		return HttpResponse.json({ message: 'Tenant not found' }, { status: 404 })
	}
	return HttpResponse.json({ redirectUrl: `${tenantUrl}/login`, suspended: false })
})

const deviceCodeHandler = (interval = 0, expiresIn = 900) =>
	http.post(`${tenantUrl}/api/oauth/device/code`, () => {
		return HttpResponse.json({
			device_code: 'long-random-device-code',
			user_code: 'ABCD1234',
			verification_uri: `${tenantUrl}/settings/oauth/device`,
			verification_uri_complete: `${tenantUrl}/settings/oauth/device?code=ABCD1234`,
			expires_in: expiresIn,
			interval,
		})
	})

const tokenSuccessHandler = (expiresIn = 3600) =>
	http.post(`${tenantUrl}/api/oauth/token`, () => {
		return HttpResponse.json({
			access_token: testAccessToken,
			token_type: 'Bearer',
			expires_in: expiresIn,
			refresh_token: testRefreshToken,
		})
	})

const projectsHandler = http.get(`${tenantUrl}/api/public/v0/project`, ({ request }) => {
	const auth = request.headers.get('Authorization')
	if (auth === `ApiKey ${testApiKey}` || auth === `Bearer ${testAccessToken}`) {
		return HttpResponse.json({ data: [], total: 0 })
	}
	return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
})

const server = setupServer(checkTenantHandler, projectsHandler)

// --- Hoisted mock state ---
// vi.hoisted runs before imports, so vi.mock factories can reference these.
// Each test configures state before runCommand(); mock implementations read at call time.

const mockState = vi.hoisted(() => ({
	teamName: 'acme',
	keyringMode: 'unavailable' as 'unavailable' | 'available',
	keyringStore: new Map<string, string>(),
	testHomeDir: '',
}))

vi.mock('../utils/prompt', () => ({
	ensureInteractive: () => {},
	prompt: async () => mockState.teamName,
}))

vi.mock('../utils/browser', () => ({
	openBrowser: () => {},
}))

vi.mock('node:os', async () => {
	const actual = await vi.importActual<typeof import('node:os')>('node:os')
	return { ...actual, homedir: () => mockState.testHomeDir }
})

vi.mock('@napi-rs/keyring', () => ({
	Entry: class MockEntry {
		private key: string
		constructor(service: string, account: string) {
			this.key = `${service}:${account}`
		}
		setPassword(password: string) {
			if (mockState.keyringMode !== 'available') {
				throw new Error('Platform secure storage failure')
			}
			mockState.keyringStore.set(this.key, password)
		}
		getPassword(): string {
			if (mockState.keyringMode !== 'available') {
				throw new Error('Platform secure storage failure')
			}
			const val = mockState.keyringStore.get(this.key)
			if (val === undefined) throw new Error('No entry')
			return val
		}
		deletePassword() {
			if (mockState.keyringMode !== 'available') {
				throw new Error('Platform secure storage failure')
			}
			if (!mockState.keyringStore.has(this.key)) throw new Error('No entry')
			mockState.keyringStore.delete(this.key)
		}
	},
}))

// --- Test setup ---

let testHomeDir: string
let log: ReturnType<typeof vi.spyOn>
let err: ReturnType<typeof vi.spyOn>
const originalEnv = { ...process.env }

function mockProcessExit() {
	return vi.spyOn(process, 'exit').mockImplementation((() => {
		throw new Error('process.exit')
	}) as never)
}

function credentialsFilePath() {
	return join(testHomeDir, '.config', 'qasphere', 'credentials.json')
}

function writeOAuthCredentials(source: 'file' | 'keyring') {
	const creds = {
		type: 'oauth',
		accessToken: testAccessToken,
		refreshToken: testRefreshToken,
		accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
		tenantUrl,
	}
	if (source === 'keyring') {
		mockState.keyringStore.set('qasphere-cli:credentials', JSON.stringify(creds))
	} else {
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(join(credDir, 'credentials.json'), JSON.stringify(creds))
	}
	return creds
}

// vi.resetModules() is still needed so module-level constants (e.g. CONFIG_DIR = join(homedir(), ...))
// re-evaluate with the current test's homedir. vi.mock (hoisted) ensures mocks always apply reliably.
async function runCommand(args: string) {
	vi.resetModules()
	const { run: freshRun } = await import('../commands/main')
	return freshRun(args.split(' '))
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
	testHomeDir = join(
		tmpdir(),
		`qas-cli-auth-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`
	)
	mkdirSync(testHomeDir, { recursive: true })

	mockState.testHomeDir = testHomeDir
	mockState.keyringMode = 'unavailable'
	mockState.keyringStore.clear()
	mockState.teamName = 'acme'

	// Clear credential env vars so resolveCredentialSource() doesn't short-circuit
	// to the env_var source, allowing tests to use test-isolated keyring/file/dotenv paths.
	delete process.env.QAS_TOKEN
	delete process.env.QAS_URL
	delete process.env.QAS_LOGIN_SERVICE_URL

	log = vi.spyOn(console, 'log').mockImplementation(() => {})
	err = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	server.resetHandlers()
	server.events.removeAllListeners()

	process.env.QAS_TOKEN = originalEnv.QAS_TOKEN
	process.env.QAS_URL = originalEnv.QAS_URL
	process.env.QAS_LOGIN_SERVICE_URL = originalEnv.QAS_LOGIN_SERVICE_URL
	if (!originalEnv.QAS_TOKEN) delete process.env.QAS_TOKEN
	if (!originalEnv.QAS_URL) delete process.env.QAS_URL
	if (!originalEnv.QAS_LOGIN_SERVICE_URL) delete process.env.QAS_LOGIN_SERVICE_URL

	if (existsSync(testHomeDir)) {
		rmSync(testHomeDir, { recursive: true })
	}

	vi.restoreAllMocks()
})

// --- Tests ---

describe('auth login (device flow)', () => {
	test('device flow login succeeds', async () => {
		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('settings/oauth/device?code='))
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))
	})

	test('device flow saves OAuth credentials', async () => {
		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')

		const credFile = credentialsFilePath()
		expect(existsSync(credFile)).toBe(true)
		const parsed = JSON.parse((await import('node:fs')).readFileSync(credFile, 'utf-8')) as Record<
			string,
			unknown
		>
		expect(parsed.type).toBe('oauth')
		expect(parsed.accessToken).toBe(testAccessToken)
		expect(parsed.refreshToken).toBe(testRefreshToken)
		expect(parsed.tenantUrl).toBe(tenantUrl)
		expect(typeof parsed.accessTokenExpiresAt).toBe('string')
	})

	test('device flow shows timeout on expiry', async () => {
		const exit = mockProcessExit()

		// Use 0 interval and 0 expiresIn so the loop exits immediately
		server.use(
			deviceCodeHandler(0, 0),
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				return HttpResponse.json(
					{ error: 'authorization_pending', error_description: 'user has not yet authorized' },
					{ status: 400 }
				)
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Authorization timed out'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('device flow handles expired_token from server', async () => {
		const exit = mockProcessExit()

		server.use(
			deviceCodeHandler(0, 900),
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				return HttpResponse.json(
					{ error: 'expired_token', error_description: 'device code expired or invalid' },
					{ status: 400 }
				)
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Authorization timed out'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('device flow handles access_denied', async () => {
		const exit = mockProcessExit()

		server.use(
			deviceCodeHandler(0, 900),
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				return HttpResponse.json(
					{ error: 'access_denied', error_description: 'user denied the request' },
					{ status: 400 }
				)
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Authorization denied'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('device flow handles slow_down by increasing interval', async () => {
		let pollCount = 0
		server.use(
			deviceCodeHandler(0, 900),
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				pollCount++
				if (pollCount === 1) {
					return HttpResponse.json(
						{ error: 'slow_down', error_description: 'polling too frequently' },
						{ status: 400 }
					)
				}
				// Second poll succeeds
				return HttpResponse.json({
					access_token: testAccessToken,
					token_type: 'Bearer',
					expires_in: 3600,
					refresh_token: testRefreshToken,
				})
			})
		)

		await runCommand('auth login')

		expect(pollCount).toBe(2)
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
	}, 10_000)

	test('device flow handles device code request failure', async () => {
		const exit = mockProcessExit()

		server.use(
			http.post(`${tenantUrl}/api/oauth/device/code`, () => {
				return HttpResponse.json(
					{ error: 'server_error', error_description: 'Internal server error' },
					{ status: 500 }
				)
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Failed to start login flow'))
		expect(exit).toHaveBeenCalledWith(1)
	})
})

describe('auth login error cases', () => {
	test('check-tenant returns 404 for unknown team', async () => {
		mockState.teamName = 'nonexistent'
		const exit = mockProcessExit()

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Could not find team'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('empty team name shows error', async () => {
		mockState.teamName = ''
		const exit = mockProcessExit()

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Team name is required'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('suspended team shows error', async () => {
		const exit = mockProcessExit()

		server.use(
			http.get(`${loginServiceUrl}/api/check-tenant`, () => {
				return HttpResponse.json({ redirectUrl: `${tenantUrl}/login`, suspended: true })
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('has been suspended'))
		expect(exit).toHaveBeenCalledWith(1)
	})
})

describe('auth login → status → logout lifecycle', () => {
	test('full lifecycle with device flow', async () => {
		server.use(deviceCodeHandler(), tokenSuccessHandler())

		// Use an isolated directory so no .qaspherecli is found after logout
		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			// Login
			await runCommand('auth login')
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))

			// Status (valid)
			log.mockClear()
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining(`Credentials connected via ${tenantUrl}`)
			)
			expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('valid'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Access token expires'))

			// Logout
			log.mockClear()
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Logged out.')
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining('authorization is still active on the server')
			)

			// Status after logout
			log.mockClear()
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})
})

describe('auth status credential sources', () => {
	test('shows env_var source when env vars are set', async () => {
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(`Credentials connected via ${tenantUrl}`)
		)
		expect(log).toHaveBeenCalledWith(expect.stringContaining('env_var'))
	})

	test('shows .env source when .env file exists', async () => {
		const envDir = join(testHomeDir, 'project')
		mkdirSync(envDir, { recursive: true })
		writeFileSync(join(envDir, '.env'), `QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`)

		const origCwd = process.cwd()
		process.chdir(envDir)
		try {
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining(`Credentials connected via ${tenantUrl}`)
			)
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.env'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('env vars take priority over .env file', async () => {
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		const envDir = join(testHomeDir, 'project')
		mkdirSync(envDir, { recursive: true })
		writeFileSync(
			join(envDir, '.env'),
			'QAS_TOKEN=other-token\nQAS_URL=https://other.qasphere.com\n'
		)

		const origCwd = process.cwd()
		process.chdir(envDir)
		try {
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(expect.stringContaining('env_var'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('shows .qaspherecli source when file exists in directory tree', async () => {
		const projectDir = join(testHomeDir, 'project')
		const subDir = join(projectDir, 'sub', 'dir')
		mkdirSync(subDir, { recursive: true })
		writeFileSync(
			join(projectDir, '.qaspherecli'),
			`QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`
		)

		const origCwd = process.cwd()
		process.chdir(subDir)
		try {
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining(`Credentials connected via ${tenantUrl}`)
			)
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.qaspherecli'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('shows invalid status when credentials are bad', async () => {
		process.env.QAS_TOKEN = 'bad-token'
		process.env.QAS_URL = tenantUrl

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('invalid or expired'))
	})

	test('shows not logged in when no credentials found', async () => {
		const emptyDir = join(testHomeDir, 'empty')
		mkdirSync(emptyDir, { recursive: true })

		const origCwd = process.cwd()
		process.chdir(emptyDir)
		try {
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})

	test.each([
		{ source: 'credentials.json' as const, setupKeyring: false },
		{ source: 'keyring' as const, setupKeyring: true },
	])('shows expiry for OAuth credentials from $source', async ({ source, setupKeyring }) => {
		if (setupKeyring) mockState.keyringMode = 'available'
		writeOAuthCredentials(setupKeyring ? 'keyring' : 'file')

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(`Credentials connected via ${tenantUrl}`)
		)
		expect(log).toHaveBeenCalledWith(expect.stringContaining(source))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('Access token expires'))
	})
})

describe('auth logout edge cases', () => {
	test('cannot log out when using env vars', async () => {
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		await runCommand('auth logout')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('Cannot log out'))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('environment variables'))
	})

	test('shows not logged in when nothing to clear', async () => {
		const emptyDir = join(testHomeDir, 'empty')
		mkdirSync(emptyDir, { recursive: true })

		const origCwd = process.cwd()
		process.chdir(emptyDir)
		try {
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})

	test('second logout after file cleared shows not logged in', async () => {
		writeOAuthCredentials('file')

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Logged out.')
			expect(existsSync(credentialsFilePath())).toBe(false)

			log.mockClear()
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})

	test('logout mentions server-side revocation', async () => {
		writeOAuthCredentials('file')

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining('authorization is still active on the server')
			)
		} finally {
			process.chdir(origCwd)
		}
	})
})

describe('auth logout source labels', () => {
	test('cannot log out when using .env file', async () => {
		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		writeFileSync(join(projectDir, '.env'), `QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`)

		const origCwd = process.cwd()
		process.chdir(projectDir)
		try {
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Cannot log out'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.env'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('cannot log out when using .qaspherecli file', async () => {
		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		writeFileSync(
			join(projectDir, '.qaspherecli'),
			`QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`
		)

		const origCwd = process.cwd()
		process.chdir(projectDir)
		try {
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Cannot log out'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.qaspherecli'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('logout warns when env vars still active after clearing credentials', async () => {
		writeOAuthCredentials('file')

		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		log.mockClear()
		await runCommand('auth logout')
		expect(log).toHaveBeenCalledWith('Logged out.')
		expect(log).toHaveBeenCalledWith(expect.stringContaining('still available'))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('environment variables'))
	})
})

describe('credential storage (keyring setPassword failure)', () => {
	test('falls back to file when keyring setPassword throws', async () => {
		// keyringMode stays 'unavailable' — setPassword throws, triggering file fallback
		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))
		expect(existsSync(credentialsFilePath())).toBe(true)
	})
})

describe('credential storage (keyring unavailable)', () => {
	test('saves to file with 0600 permissions', async () => {
		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')

		const credFile = credentialsFilePath()
		expect(existsSync(credFile)).toBe(true)
		expect(statSync(credFile).mode & 0o777).toBe(0o600)
	})

	test('overwrites existing credentials on re-login', async () => {
		const secondAccessToken = 'tenantId.authId7chars.secondAccessToken'
		const secondRefreshToken = 'tenantId.authId7chars.secondRefreshToken'

		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')

		// Re-login with different tokens
		server.use(
			deviceCodeHandler(),
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				return HttpResponse.json({
					access_token: secondAccessToken,
					token_type: 'Bearer',
					expires_in: 3600,
					refresh_token: secondRefreshToken,
				})
			})
		)

		log.mockClear()
		await runCommand('auth login')
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))

		// Verify file has the new token
		const parsed = JSON.parse(
			(await import('node:fs')).readFileSync(credentialsFilePath(), 'utf-8')
		) as Record<string, unknown>
		expect(parsed.accessToken).toBe(secondAccessToken)
	})
})

describe('credential storage (keyring available)', () => {
	test('saves to keyring when available', async () => {
		mockState.keyringMode = 'available'

		server.use(deviceCodeHandler(), tokenSuccessHandler())

		expect(mockState.keyringStore.size).toBe(0)
		await runCommand('auth login')

		expect(mockState.keyringStore.size).toBe(1)
		const value = Array.from(mockState.keyringStore.values())[0]
		const parsed = JSON.parse(value) as Record<string, unknown>
		expect(parsed.type).toBe('oauth')
		expect(parsed.accessToken).toBe(testAccessToken)
		expect(parsed.tenantUrl).toBe(tenantUrl)
		expect(log).toHaveBeenCalledWith(expect.stringContaining('keyring'))
		expect(existsSync(credentialsFilePath())).toBe(false)
	})

	test('logout clears keyring entry', async () => {
		mockState.keyringMode = 'available'

		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')
		expect(mockState.keyringStore.size).toBe(1)

		log.mockClear()
		await runCommand('auth logout')
		expect(log).toHaveBeenCalledWith('Logged out.')
		expect(mockState.keyringStore.size).toBe(0)
	})

	test('second logout after keyring cleared shows not logged in', async () => {
		mockState.keyringMode = 'available'

		server.use(deviceCodeHandler(), tokenSuccessHandler())

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			await runCommand('auth login')
			expect(mockState.keyringStore.size).toBe(1)

			log.mockClear()
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Logged out.')

			log.mockClear()
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})

	test('auth status shows keyring as source', async () => {
		mockState.keyringMode = 'available'

		server.use(deviceCodeHandler(), tokenSuccessHandler())

		await runCommand('auth login')
		expect(mockState.keyringStore.size).toBe(1)

		log.mockClear()
		await runCommand('auth status')
		expect(log).toHaveBeenCalledWith(expect.stringContaining('keyring'))
	})
})

describe('credential resolution edge cases', () => {
	test('partial env vars (only QAS_TOKEN) falls through to .qaspherecli', async () => {
		process.env.QAS_TOKEN = 'env-only-token' // Invalid token should fail assertions below if it were used
		// QAS_URL intentionally not set — should not resolve as env_var

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		writeFileSync(
			join(projectDir, '.qaspherecli'),
			`QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`
		)

		const origCwd = process.cwd()
		process.chdir(projectDir)
		try {
			await runCommand('auth status')
			expect(log).not.toHaveBeenCalledWith(expect.stringContaining('env_var'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.qaspherecli'))
			expect(log).toHaveBeenCalledWith(
				expect.stringContaining(`Credentials connected via ${tenantUrl}`)
			)
		} finally {
			process.chdir(origCwd)
		}
	})

	test('corrupt credentials file warns and falls back gracefully', async () => {
		// Write garbage to the credentials file
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(join(credDir, 'credentials.json'), 'not valid json{{{')

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const emptyDir = join(testHomeDir, 'empty')
		mkdirSync(emptyDir, { recursive: true })

		const origCwd = process.cwd()
		process.chdir(emptyDir)
		try {
			await runCommand('auth status')
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('could not read credentials'))
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})

	test('credentials file with wrong shape warns and falls back gracefully', async () => {
		// Write valid JSON but wrong shape (legacy apiKey format without type)
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(join(credDir, 'credentials.json'), '{"apiKey": "test", "tenantUrl": "test"}')

		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const emptyDir = join(testHomeDir, 'empty')
		mkdirSync(emptyDir, { recursive: true })

		const origCwd = process.cwd()
		process.chdir(emptyDir)
		try {
			await runCommand('auth status')
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('invalid format'))
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})
})

describe('token refresh at load time', () => {
	test('refreshes expired access token before running command', async () => {
		// Write credentials with expired access token
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(
			join(credDir, 'credentials.json'),
			JSON.stringify({
				type: 'oauth',
				accessToken: 'expired-access-token',
				refreshToken: testRefreshToken,
				accessTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(), // expired 1 min ago
				tenantUrl,
			})
		)

		const refreshedAccessToken = 'tenantId.authId7chars.refreshedAccessToken'
		const refreshedRefreshToken = 'tenantId.authId7chars.refreshedRefreshToken'

		server.use(
			http.post(`${tenantUrl}/api/oauth/token`, async ({ request }) => {
				const body = (await request.json()) as Record<string, string>
				if (body.grant_type === 'refresh_token' && body.refresh_token === testRefreshToken) {
					return HttpResponse.json({
						access_token: refreshedAccessToken,
						token_type: 'Bearer',
						expires_in: 3600,
						refresh_token: refreshedRefreshToken,
					})
				}
				return HttpResponse.json(
					{ error: 'invalid_grant', error_description: 'invalid refresh token' },
					{ status: 401 }
				)
			}),
			http.get(`${tenantUrl}/api/public/v0/project`, ({ request }) => {
				const auth = request.headers.get('Authorization')
				if (auth === `Bearer ${refreshedAccessToken}`) {
					return HttpResponse.json({ data: [], total: 0 })
				}
				return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
			})
		)

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(`Credentials connected via ${tenantUrl}`)
		)
		expect(log).toHaveBeenCalledWith(expect.stringContaining('valid'))

		// Verify credentials file was updated with new tokens
		const parsed = JSON.parse(
			(await import('node:fs')).readFileSync(credentialsFilePath(), 'utf-8')
		) as Record<string, unknown>
		expect(parsed.accessToken).toBe(refreshedAccessToken)
		expect(parsed.refreshToken).toBe(refreshedRefreshToken)
	})

	test('expired refresh token shows session expired message', async () => {
		const exit = mockProcessExit()

		// Write credentials with expired access token and a refresh token that will fail
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(
			join(credDir, 'credentials.json'),
			JSON.stringify({
				type: 'oauth',
				accessToken: 'expired-access-token',
				refreshToken: 'expired-refresh-token',
				accessTokenExpiresAt: new Date(Date.now() - 60_000).toISOString(),
				tenantUrl,
			})
		)

		server.use(
			http.post(`${tenantUrl}/api/oauth/token`, () => {
				return HttpResponse.json(
					{ error: 'invalid_grant', error_description: 'refresh token expired' },
					{ status: 401 }
				)
			})
		)

		const emptyDir = join(testHomeDir, 'empty')
		mkdirSync(emptyDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(emptyDir)

		try {
			await runCommand('auth status').catch(() => {})

			expect(err).toHaveBeenCalledWith(expect.stringContaining('Session expired'))
			expect(err).toHaveBeenCalledWith(expect.stringContaining('qasphere auth login'))
			expect(exit).toHaveBeenCalledWith(1)
		} finally {
			process.chdir(origCwd)
		}
	})

	test('refreshes expired access token stored in keyring and persists back to keyring', async () => {
		mockState.keyringMode = 'available'
		writeOAuthCredentials('keyring')

		// Override the access token to be expired
		const key = 'qasphere-cli:credentials'
		const creds = JSON.parse(mockState.keyringStore.get(key)!) as Record<string, unknown>
		creds.accessTokenExpiresAt = new Date(Date.now() - 60_000).toISOString()
		mockState.keyringStore.set(key, JSON.stringify(creds))

		const refreshedAccessToken = 'tenantId.authId7chars.refreshedAccessToken'
		const refreshedRefreshToken = 'tenantId.authId7chars.refreshedRefreshToken'

		server.use(
			http.post(`${tenantUrl}/api/oauth/token`, async ({ request }) => {
				const body = (await request.json()) as Record<string, string>
				if (body.grant_type === 'refresh_token' && body.refresh_token === testRefreshToken) {
					return HttpResponse.json({
						access_token: refreshedAccessToken,
						token_type: 'Bearer',
						expires_in: 3600,
						refresh_token: refreshedRefreshToken,
					})
				}
				return HttpResponse.json(
					{ error: 'invalid_grant', error_description: 'invalid refresh token' },
					{ status: 401 }
				)
			}),
			http.get(`${tenantUrl}/api/public/v0/project`, ({ request }) => {
				const auth = request.headers.get('Authorization')
				if (auth === `Bearer ${refreshedAccessToken}`) {
					return HttpResponse.json({ data: [], total: 0 })
				}
				return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
			})
		)

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(
			expect.stringContaining(`Credentials connected via ${tenantUrl}`)
		)
		expect(log).toHaveBeenCalledWith(expect.stringContaining('valid'))

		// Verify keyring was updated with new tokens
		const updated = JSON.parse(mockState.keyringStore.get(key)!) as Record<string, unknown>
		expect(updated.accessToken).toBe(refreshedAccessToken)
		expect(updated.refreshToken).toBe(refreshedRefreshToken)

		// Verify credentials file was NOT created
		expect(existsSync(credentialsFilePath())).toBe(false)
	})
})

describe('logout error handling', () => {
	test('clearCredentials failure shows error and exits', async () => {
		const exit = mockProcessExit()

		mockState.keyringMode = 'available'
		writeOAuthCredentials('keyring')

		// Make keyring deletion throw
		const originalDelete = mockState.keyringStore.delete.bind(mockState.keyringStore)
		mockState.keyringStore.delete = () => {
			throw new Error('Keyring access denied')
		}

		try {
			await runCommand('auth logout').catch(() => {})

			expect(err).toHaveBeenCalledWith(
				expect.stringContaining('Could not clear credentials from keyring')
			)
			expect(err).toHaveBeenCalledWith(expect.stringContaining('Keyring access denied'))
			expect(exit).toHaveBeenCalledWith(1)
		} finally {
			mockState.keyringStore.delete = originalDelete
		}
	})
})
