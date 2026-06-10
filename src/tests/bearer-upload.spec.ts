import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'
import { runTestCases } from './fixtures/testcases'
import { countMockedApiCalls } from './utils'

const projectCode = 'TEST'
const runId = '1'
const baseURL = 'https://oauth-tenant.eu1.qasphere.com'
const runURL = `${baseURL}/project/${projectCode}/run/${runId}`
const testAccessToken = 'tenantId.authId7chars.bearerAccessToken'
const testRefreshToken = 'tenantId.authId7chars.bearerRefreshToken'
const expectedAuth = `Bearer ${testAccessToken}`

const mockState = vi.hoisted(() => ({
	testHomeDir: '',
}))

vi.mock('node:os', async () => {
	const actual = await vi.importActual<typeof import('node:os')>('node:os')
	return { ...actual, homedir: () => mockState.testHomeDir }
})

// Prevent the real OS keyring from leaking credentials into tests
vi.mock('@napi-rs/keyring', () => ({
	Entry: class MockEntry {
		setPassword(): void {
			throw new Error('keyring disabled in test')
		}
		getPassword(): string {
			throw new Error('keyring disabled in test')
		}
		deletePassword(): void {
			throw new Error('keyring disabled in test')
		}
	},
}))

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project/${projectCode}`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ exists: true })
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/tcase/folders`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ data: [], total: 0, offset: 0, limit: 50 })
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ data: [], total: 0, offset: 0, limit: 50 })
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/tcase/seq`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ data: runTestCases, total: runTestCases.length })
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/run`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ id: parseInt(runId) })
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ tcases: runTestCases })
	}),
	http.post(
		new RegExp(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/result/batch`),
		({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(expectedAuth)
			return HttpResponse.json({ ids: [0] })
		}
	),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/log`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ id: 'log-1' })
	}),
	http.post(`${baseURL}/api/public/v0/file/batch`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual(expectedAuth)
		return HttpResponse.json({ files: [] })
	})
)

const countResultUploadApiCalls = () =>
	countMockedApiCalls(server, (req) => new URL(req.url).pathname.endsWith('/result/batch'))

function writeOAuthCredentialsFile() {
	const creds = {
		type: 'oauth',
		accessToken: testAccessToken,
		refreshToken: testRefreshToken,
		accessTokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
		refreshTokenExpiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString(),
		tenantUrl: baseURL,
	}
	const credDir = join(mockState.testHomeDir, '.config', 'qasphere')
	mkdirSync(credDir, { recursive: true })
	writeFileSync(join(credDir, 'credentials.json'), JSON.stringify(creds))
}

async function runFresh(args: string) {
	vi.resetModules()
	const { run } = await import('../commands/main')
	await run(args.split(' '))
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
	mockState.testHomeDir = join(
		tmpdir(),
		`qas-cli-bearer-${Date.now()}-${Math.random().toString(36).slice(2)}`
	)
	mkdirSync(mockState.testHomeDir, { recursive: true })

	// Strip API-key env so resolveCredentialSource falls through to the credentials file
	delete process.env.QAS_TOKEN
	delete process.env.QAS_URL

	writeOAuthCredentialsFile()
})

afterEach(() => {
	server.resetHandlers()
	server.events.removeAllListeners()
	rmSync(mockState.testHomeDir, { recursive: true, force: true })
})

describe('upload commands with OAuth bearer auth', () => {
	test('junit-upload sends Authorization: Bearer', async () => {
		const numResultUploadCalls = countResultUploadApiCalls()
		await runFresh(`junit-upload -r ${runURL} ./src/tests/fixtures/junit-xml/matching-tcases.xml`)
		expect(numResultUploadCalls()).toBe(1)
	})

	test('playwright-json-upload sends Authorization: Bearer', async () => {
		const numResultUploadCalls = countResultUploadApiCalls()
		await runFresh(
			`playwright-json-upload -r ${runURL} ./src/tests/fixtures/playwright-json/matching-tcases.json`
		)
		expect(numResultUploadCalls()).toBe(1)
	})

	test('allure-upload sends Authorization: Bearer', async () => {
		const numResultUploadCalls = countResultUploadApiCalls()
		await runFresh(`allure-upload -r ${runURL} ./src/tests/fixtures/allure/matching-tcases`)
		expect(numResultUploadCalls()).toBe(1)
	})
})
