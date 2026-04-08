import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

const loginServiceUrl = 'https://login.qasphere.com'
const tenantUrl = 'https://acme.eu1.qasphere.com'
const testApiKey = 'tenantId.keyId.keyToken'
const testApiKeyName = 'My CLI Key'
const testEmail = 'user@example.com'

// --- MSW handlers ---

const checkTenantHandler = http.get(`${loginServiceUrl}/api/check-tenant`, ({ request }) => {
	const url = new URL(request.url)
	const name = url.searchParams.get('name')
	if (!name || name === 'nonexistent') {
		return HttpResponse.json({ message: 'Tenant not found' }, { status: 404 })
	}
	return HttpResponse.json({ redirectUrl: `${tenantUrl}/login` })
})

const deviceCodeHandler = (interval = 0, expiresIn = 900) =>
	http.post(`${tenantUrl}/api/auth/device/code`, () => {
		return HttpResponse.json({
			userCode: 'ABCD1234',
			deviceCode: 'long-random-device-code',
			expiresIn,
			interval,
		})
	})

const projectsHandler = http.get(`${tenantUrl}/api/public/v0/project`, ({ request }) => {
	const auth = request.headers.get('Authorization')
	if (auth === `ApiKey ${testApiKey}`) {
		return HttpResponse.json({ data: [], total: 0 })
	}
	return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
})

const server = setupServer(checkTenantHandler, projectsHandler)

// --- Test setup ---

let testHomeDir: string
let log: ReturnType<typeof vi.spyOn>
let err: ReturnType<typeof vi.spyOn>
const originalEnv = { ...process.env }

function mockKeyringUnavailable() {
	vi.doMock('@napi-rs/keyring', () => ({
		Entry: class MockEntry {
			setPassword() {
				throw new Error('Platform secure storage failure')
			}
			getPassword(): string {
				throw new Error('Platform secure storage failure')
			}
			deletePassword() {
				throw new Error('Platform secure storage failure')
			}
		},
	}))
}

function mockKeyringAvailable(): Map<string, string> {
	const store = new Map<string, string>()
	vi.doMock('@napi-rs/keyring', () => ({
		Entry: class MockEntry {
			private key: string
			constructor(service: string, account: string) {
				this.key = `${service}:${account}`
			}
			setPassword(password: string) {
				store.set(this.key, password)
			}
			getPassword(): string {
				const val = store.get(this.key)
				if (val === undefined) throw new Error('No entry')
				return val
			}
			deletePassword() {
				if (!store.has(this.key)) throw new Error('No entry')
				store.delete(this.key)
			}
		},
	}))
	return store
}

function mockPrompts(teamName: string, apiKey = '') {
	vi.doMock('../utils/prompt', () => ({
		ensureInteractive: () => {},
		prompt: async () => teamName,
		promptHidden: async () => apiKey,
	}))
}

function mockBrowser() {
	vi.doMock('../utils/browser', () => ({
		openBrowser: () => {},
	}))
}

function mockProcessExit() {
	return vi.spyOn(process, 'exit').mockImplementation((() => {
		throw new Error('process.exit')
	}) as never)
}

function credentialsFilePath() {
	return join(testHomeDir, '.config', 'qasphere', 'credentials.json')
}

// vi.doMock only affects future imports. Since each test sets up different mocks (different prompts, keyring available vs unavailable),
// we need resetModules() + dynamic import to get a fresh module tree that picks up the current test's mocks.
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

	vi.doMock('node:os', async () => {
		const actual = await vi.importActual<typeof import('node:os')>('node:os')
		return { ...actual, homedir: () => testHomeDir }
	})

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

	vi.doUnmock('node:os')
	vi.doUnmock('@napi-rs/keyring')
	vi.doUnmock('../utils/prompt')
	vi.doUnmock('../utils/browser')
	vi.restoreAllMocks()
})

// --- Tests ---

describe('auth login --api-key lifecycle', () => {
	test('login → status → logout → status', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme', testApiKey)

		// Use an isolated directory so no .qaspherecli is found after logout
		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			// Login
			await runCommand('auth login --api-key')
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))

			// Status (valid)
			log.mockClear()
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('credentials.json'))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('valid'))

			// Logout
			log.mockClear()
			await runCommand('auth logout')
			expect(log).toHaveBeenCalledWith('Logged out.')

			// Status after logout
			log.mockClear()
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith('Not logged in.')
		} finally {
			process.chdir(origCwd)
		}
	})
})

describe('auth login (device flow)', () => {
	test('device flow login succeeds', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme')
		mockBrowser()

		server.use(
			deviceCodeHandler(),
			http.post(`${tenantUrl}/api/auth/device/token`, () => {
				return HttpResponse.json({
					status: 'approved',
					data: {
						apiKey: testApiKey,
						apiKeyName: testApiKeyName,
						tenantUrl: tenantUrl,
						email: testEmail,
					},
				})
			})
		)

		await runCommand('auth login')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('ABCD-1234'))
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
		expect(log).toHaveBeenCalledWith(expect.stringContaining(testApiKeyName))
	})

	test('device flow shows timeout on expiry', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme')
		mockBrowser()
		const exit = mockProcessExit()

		// Use 0 interval and 0 expiresIn so the loop exits immediately
		server.use(
			deviceCodeHandler(0, 0),
			http.post(`${tenantUrl}/api/auth/device/token`, () => {
				return HttpResponse.json({ status: 'pending' })
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Authorization timed out'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('device flow handles device code request failure', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme')
		mockBrowser()
		const exit = mockProcessExit()

		server.use(
			http.post(`${tenantUrl}/api/auth/device/code`, () => {
				return HttpResponse.json({ message: 'Internal server error' }, { status: 500 })
			})
		)

		await runCommand('auth login').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Failed to start login flow'))
		expect(exit).toHaveBeenCalledWith(1)
	})
})

describe('auth login error cases', () => {
	test('check-tenant returns 404 for unknown team', async () => {
		mockKeyringUnavailable()
		mockPrompts('nonexistent', testApiKey)
		const exit = mockProcessExit()

		await runCommand('auth login --api-key').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Could not find team'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('empty team name shows error', async () => {
		mockKeyringUnavailable()
		mockPrompts('', testApiKey)
		const exit = mockProcessExit()

		await runCommand('auth login --api-key').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('Team name is required'))
		expect(exit).toHaveBeenCalledWith(1)
	})

	test('empty API key shows error', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme', '')
		const exit = mockProcessExit()

		await runCommand('auth login --api-key').catch(() => {})

		expect(err).toHaveBeenCalledWith(expect.stringContaining('API key is required'))
		expect(exit).toHaveBeenCalledWith(1)
	})
})

describe('auth status credential sources', () => {
	test('shows env_var source when env vars are set', async () => {
		mockKeyringUnavailable()
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('env_var'))
	})

	test('shows .env source when .env file exists', async () => {
		mockKeyringUnavailable()

		const envDir = join(testHomeDir, 'project')
		mkdirSync(envDir, { recursive: true })
		writeFileSync(join(envDir, '.env'), `QAS_TOKEN=${testApiKey}\nQAS_URL=${tenantUrl}\n`)

		const origCwd = process.cwd()
		process.chdir(envDir)
		try {
			await runCommand('auth status')
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.env'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('env vars take priority over .env file', async () => {
		mockKeyringUnavailable()
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
		mockKeyringUnavailable()

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
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
			expect(log).toHaveBeenCalledWith(expect.stringContaining('.qaspherecli'))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('shows invalid status when credentials are bad', async () => {
		mockKeyringUnavailable()
		process.env.QAS_TOKEN = 'bad-token'
		process.env.QAS_URL = tenantUrl

		await runCommand('auth status')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('invalid or expired'))
	})

	test('shows not logged in when no credentials found', async () => {
		mockKeyringUnavailable()

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
})

describe('auth logout edge cases', () => {
	test('cannot log out when using env vars', async () => {
		mockKeyringUnavailable()
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		await runCommand('auth logout')

		expect(log).toHaveBeenCalledWith(expect.stringContaining('Cannot log out'))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('environment variables'))
	})

	test('shows not logged in when nothing to clear', async () => {
		mockKeyringUnavailable()

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
		mockKeyringUnavailable()
		mockPrompts('acme', testApiKey)

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			await runCommand('auth login --api-key')
			expect(existsSync(credentialsFilePath())).toBe(true)

			log.mockClear()
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
})

describe('credential storage (keyring unavailable)', () => {
	test('saves to file with 0600 permissions', async () => {
		mockKeyringUnavailable()
		mockPrompts('acme', testApiKey)

		await runCommand('auth login --api-key')

		const credFile = credentialsFilePath()
		expect(existsSync(credFile)).toBe(true)
		expect(statSync(credFile).mode & 0o777).toBe(0o600)
	})

	test('overwrites existing credentials on re-login', async () => {
		const secondApiKey = 'tenantId.keyId2.keyToken2'

		// Accept both API keys for validation
		server.use(
			http.get(`${tenantUrl}/api/public/v0/project`, ({ request }) => {
				const auth = request.headers.get('Authorization')
				if (auth === `ApiKey ${testApiKey}` || auth === `ApiKey ${secondApiKey}`) {
					return HttpResponse.json({ data: [], total: 0 })
				}
				return HttpResponse.json({ message: 'Unauthorized' }, { status: 401 })
			})
		)

		mockKeyringUnavailable()
		mockPrompts('acme', testApiKey)

		await runCommand('auth login --api-key')

		// Re-login with different valid key
		vi.doUnmock('../utils/prompt')
		mockPrompts('acme', secondApiKey)

		log.mockClear()
		await runCommand('auth login --api-key')
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))

		// Verify status uses the new key
		log.mockClear()
		await runCommand('auth status')
		expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
	})
})

describe('credential storage (keyring available)', () => {
	test('saves to keyring when available', async () => {
		const store = mockKeyringAvailable()
		mockPrompts('acme', testApiKey)

		expect(store.size).toBe(0)
		await runCommand('auth login --api-key')

		expect(store.size).toBe(1)
		const value = Array.from(store.values())[0]
		expect(JSON.parse(value)).toEqual({ tenantUrl, apiKey: testApiKey })
		expect(log).toHaveBeenCalledWith(expect.stringContaining('keyring'))
		expect(existsSync(credentialsFilePath())).toBe(false)
	})

	test('logout clears keyring entry', async () => {
		const store = mockKeyringAvailable()
		mockPrompts('acme', testApiKey)

		await runCommand('auth login --api-key')
		expect(store.size).toBe(1)
		const value = Array.from(store.values())[0]
		expect(JSON.parse(value)).toEqual({ tenantUrl, apiKey: testApiKey })
		log.mockClear()
		await runCommand('auth logout')
		expect(log).toHaveBeenCalledWith('Logged out.')
		expect(store.size).toBe(0)
	})

	test('second logout after keyring cleared shows not logged in', async () => {
		mockKeyringAvailable()
		mockPrompts('acme', testApiKey)

		const projectDir = join(testHomeDir, 'project')
		mkdirSync(projectDir, { recursive: true })
		const origCwd = process.cwd()
		process.chdir(projectDir)

		try {
			await runCommand('auth login --api-key')

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
		mockKeyringAvailable()
		mockPrompts('acme', testApiKey)

		await runCommand('auth login --api-key')

		log.mockClear()
		await runCommand('auth status')
		expect(log).toHaveBeenCalledWith(expect.stringContaining('keyring'))
	})
})

describe('credential resolution edge cases', () => {
	test('partial env vars (only QAS_TOKEN) falls through to .qaspherecli', async () => {
		mockKeyringUnavailable()
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
			expect(log).toHaveBeenCalledWith(expect.stringContaining(`Logged in to ${tenantUrl}`))
		} finally {
			process.chdir(origCwd)
		}
	})

	test('corrupt credentials file warns and falls back gracefully', async () => {
		mockKeyringUnavailable()

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
		mockKeyringUnavailable()

		// Write valid JSON but wrong shape
		const credDir = join(testHomeDir, '.config', 'qasphere')
		mkdirSync(credDir, { recursive: true })
		writeFileSync(join(credDir, 'credentials.json'), '{"foo": "bar"}')

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

describe('auth logout source labels', () => {
	test('cannot log out when using .env file', async () => {
		mockKeyringUnavailable()

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
		mockKeyringUnavailable()

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

	test('logout warns when env vars still active after clearing keyring', async () => {
		mockKeyringAvailable()
		mockPrompts('acme', testApiKey)

		await runCommand('auth login --api-key')

		// Set env vars that will persist after keyring is cleared
		process.env.QAS_TOKEN = testApiKey
		process.env.QAS_URL = tenantUrl

		log.mockClear()
		await runCommand('auth logout')
		expect(log).toHaveBeenCalledWith('Logged out.')
		expect(log).toHaveBeenCalledWith(expect.stringContaining('still available'))
		expect(log).toHaveBeenCalledWith(expect.stringContaining('environment variables'))
	})
})
