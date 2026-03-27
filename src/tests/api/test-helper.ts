import { inject, test as baseTest, vi, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { setupServer, type SetupServerApi } from 'msw/node'
import type { RequestHandler } from 'msw'
import { createApi } from '../../api/index'
import { randomBytes } from 'node:crypto'
import { run } from '../../commands/main'

declare module 'vitest' {
	export interface ProvidedContext {
		sessionToken: string | null
	}
}

const { QAS_TEST_URL, QAS_TEST_TOKEN, QAS_TEST_USERNAME, QAS_TEST_PASSWORD, QAS_DEV_AUTH } =
	process.env

const isRealApi = !!(QAS_TEST_URL && QAS_TEST_TOKEN && QAS_TEST_USERNAME && QAS_TEST_PASSWORD)

function configureEnv(): { baseURL: string; token: string } {
	if (isRealApi) {
		const baseURL = QAS_TEST_URL!
		const token = QAS_TEST_TOKEN!
		process.env['QAS_URL'] = baseURL
		process.env['QAS_TOKEN'] = token
		return { baseURL, token }
	}
	const baseURL = 'https://qas.eu1.qasphere.com'
	process.env['QAS_URL'] = baseURL
	process.env['QAS_TOKEN'] = 'QAS_TOKEN'
	return { baseURL, token: 'QAS_TOKEN' }
}

export const { baseURL, token } = configureEnv()

interface TestProject {
	code: string
	id: string
}

function generateProjectCode(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
	const bytes = randomBytes(4)
	let code = 'T'
	for (let i = 0; i < 4; i++) {
		code += chars[bytes[i] % chars.length]
	}
	return code
}

async function createTestProject(baseURL: string, token: string): Promise<TestProject> {
	const api = createApi(baseURL, token)
	const code = generateProjectCode()
	const created = await api.projects.create({ code, title: `[CLI] Test ${code}` })
	const project = await api.projects.get(created.id)
	return { code: project.code, id: project.id }
}

async function deleteTestProject(baseURL: string, code: string): Promise<void> {
	const sessionToken = inject('sessionToken')
	if (!sessionToken) {
		throw new Error('No session token provided — check globalSetup login')
	}
	const cookies = [`session=${sessionToken}`]
	if (QAS_DEV_AUTH) {
		cookies.push(`_devauth=${QAS_DEV_AUTH}`)
	}
	await fetch(`${baseURL}/api/project/${code}`, {
		method: 'DELETE',
		headers: { Cookie: cookies.join('; ') },
	})
}

function mockConsoleLog() {
	const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
	return spy
}

export function useMockServer(...handlers: RequestHandler[]): SetupServerApi {
	const server = setupServer(...handlers)
	beforeAll(() => server.listen())
	afterAll(() => server.close())
	afterEach(() => server.resetHandlers())
	return server
}

export async function runCli<T = unknown>(...args: string[]): Promise<T> {
	const spy = mockConsoleLog()
	await run(args)
	const calls = spy.mock.calls
	spy.mockRestore()
	if (calls.length === 0) return undefined as T
	return JSON.parse(calls[calls.length - 1][0] as string) as T
}

export async function createFolder(projectCode: string): Promise<{ ids: number[][] }> {
	const uid = randomBytes(4).toString('hex')
	return runCli<{ ids: number[][] }>(
		'api',
		'folders',
		'bulk-create',
		'--project-code',
		projectCode,
		'--folders',
		JSON.stringify({ folders: [{ path: [`CLITest_${uid}`] }] })
	)
}

export async function createTCase(
	projectCode: string,
	folderId: number
): Promise<{ id: string; seq: number }> {
	const uid = randomBytes(4).toString('hex')
	return runCli<{ id: string; seq: number }>(
		'api',
		'test-cases',
		'create',
		'--project-code',
		projectCode,
		'--body',
		JSON.stringify({
			title: `CLI Test ${uid}`,
			type: 'standalone',
			folderId,
			priority: 'medium',
		})
	)
}

export async function createRun(projectCode: string, tcaseIds: string[]): Promise<{ id: number }> {
	const uid = randomBytes(4).toString('hex')
	return runCli<{ id: number }>(
		'api',
		'runs',
		'create',
		'--project-code',
		projectCode,
		'--title',
		`CLI Run ${uid}`,
		'--type',
		'static',
		'--query-plans',
		JSON.stringify([{ tcaseIds }])
	)
}

type ParamType = 'code' | 'int' | 'resource'

const paramTypePatterns: Record<ParamType, RegExp> = {
	code: /must contain only latin letters and digits/,
	int: /must be a positive integer/,
	resource: /must contain only alphanumeric characters, dashes, and underscores/,
}

export function testRejectsInvalidIdentifier(
	runCommand: (...args: string[]) => Promise<unknown>,
	paramName: string,
	type: ParamType,
	otherRequiredArgs: string[] = []
) {
	test(`rejects ${paramName} with special characters`, async () => {
		await expectValidationError(
			() => runCommand(`--${paramName}`, 'PRJ/123', ...otherRequiredArgs),
			paramTypePatterns[type]
		)
	})
}

export async function expectValidationError(
	runner: () => Promise<unknown>,
	expectedPattern: RegExp
): Promise<void> {
	const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
		throw new Error('process.exit')
	})
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
	try {
		await expect(runner()).rejects.toThrow('process.exit')
		const errorOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
		expect(errorOutput).toMatch(expectedPattern)
	} finally {
		exitSpy.mockRestore()
		errorSpy.mockRestore()
	}
}

export const test = baseTest.extend<{ project: TestProject }>({
	// eslint-disable-next-line no-empty-pattern, @typescript-eslint/no-empty-object-type
	project: async ({}: {}, use) => {
		if (!isRealApi) {
			await use({ code: 'PRJ', id: 'mock-id' })
			return
		}
		const env = configureEnv()
		const project = await createTestProject(env.baseURL, env.token)
		await use(project)
		await deleteTestProject(env.baseURL, project.code)
	},
})
