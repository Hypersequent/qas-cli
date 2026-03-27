import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

import { executeApiCommand } from '../commands/api/executor'
import { apiEndpointSpecById } from '../commands/api/manifest'
import { run } from '../commands/main'

const baseURL = 'https://qas.eu1.qasphere.com'
process.env.QAS_URL = baseURL
process.env.QAS_TOKEN = 'QAS_TOKEN'

let stdout = ''

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project`, () =>
		HttpResponse.json({
			projects: [
				{
					id: '1',
					code: 'DEMO',
					title: 'Demo Project',
					description: '',
					overviewTitle: '',
					overviewDescription: '',
					links: [],
					createdAt: '2025-01-01T00:00:00.000Z',
					updatedAt: '2025-01-01T00:00:00.000Z',
					archivedAt: null,
				},
			],
		})
	),
	http.post(`${baseURL}/api/public/v0/project`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toBe('ApiKey QAS_TOKEN')
		expect(await request.json()).toEqual({
			code: 'DEMO',
			title: 'Demo Project',
			links: null,
			overviewTitle: null,
			overviewDescription: null,
		})
		return HttpResponse.json({ id: 10 }, { status: 201 })
	}),
	http.patch(`${baseURL}/api/public/v0/project/DEMO/tcase/123`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toBe('ApiKey QAS_TOKEN')
		expect(await request.json()).toEqual({
			title: 'Updated',
			requirements: null,
			links: null,
			tags: null,
			steps: [{ sharedStepId: 9, description: '', expected: '' }],
			files: null,
			precondition: { sharedPreconditionId: 42 },
		})
		return HttpResponse.json({ message: 'Test case updated' })
	}),
	http.post(`${baseURL}/api/public/v0/file`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toBe('ApiKey QAS_TOKEN')
		const form = await request.formData()
		const file = form.get('file')
		expect(file).toBeInstanceOf(File)
		expect((file as File).name).toBe('upload.txt')
		return HttpResponse.json({ id: 'file-1', url: `${baseURL}/api/file/file-1` })
	})
)

beforeAll(() => {
	server.listen({ onUnhandledRequest: 'error' })
})

afterAll(() => {
	server.close()
})

beforeEach(() => {
	stdout = ''
	vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: string | Uint8Array) => {
		stdout += chunk.toString()
		return true
	}) as typeof process.stdout.write)
})

afterEach(() => {
	server.resetHandlers()
	vi.restoreAllMocks()
})

describe('qasphere api command', () => {
	test('prints pretty JSON for GET commands', async () => {
		await run(['api', 'projects', 'list'])

		expect(stdout).toBe(
			`${JSON.stringify(
				{
					projects: [
						{
							id: '1',
							code: 'DEMO',
							title: 'Demo Project',
							description: '',
							overviewTitle: '',
							overviewDescription: '',
							links: [],
							createdAt: '2025-01-01T00:00:00.000Z',
							updatedAt: '2025-01-01T00:00:00.000Z',
							archivedAt: null,
						},
					],
				},
				null,
				2
			)}\n`
		)
	})

	test('sends POST JSON from --body-file', async () => {
		await run([
			'api',
			'projects',
			'create',
			'--body-file',
			'./src/tests/fixtures/api/create-project.json',
		])

		expect(stdout).toBe(`${JSON.stringify({ id: 10 }, null, 2)}\n`)
	})

	test('sends PATCH JSON from inline body', async () => {
		await run([
			'api',
			'testcases',
			'update',
			'DEMO',
			'123',
			'--body',
			JSON.stringify({
				title: 'Updated',
				precondition: { id: 42 },
				steps: [{ sharedStepId: 9 }],
			}),
		])

		expect(stdout).toBe(`${JSON.stringify({ message: 'Test case updated' }, null, 2)}\n`)
	})

	test('uploads multipart files', async () => {
		await run(['api', 'files', 'upload', '--file', './src/tests/fixtures/api/upload.txt'])

		expect(stdout).toBe(
			`${JSON.stringify({ id: 'file-1', url: `${baseURL}/api/file/file-1` }, null, 2)}\n`
		)
	})

	test('surfaces API failure responses', async () => {
		server.use(
			http.post(`${baseURL}/api/public/v0/project`, () =>
				HttpResponse.json({ message: 'duplicate project code' }, { status: 409 })
			)
		)

		const spec = apiEndpointSpecById.get('projects.create')!
		await expect(
			executeApiCommand(
				spec,
				{
					body: JSON.stringify({ code: 'DEMO', title: 'Demo Project' }),
				},
				{ baseUrl: baseURL, apiKey: 'QAS_TOKEN' }
			)
		).rejects.toThrow('duplicate project code')
	})

	test('validates representative response shapes through the manifest schema', async () => {
		const spec = apiEndpointSpecById.get('projects.list')!
		const response = await executeApiCommand(spec, {}, { baseUrl: baseURL, apiKey: 'QAS_TOKEN' })

		expect(spec.responseSchema?.safeParse(response).success).toBe(true)
	})

	test('rejects unknown flags through yargs strict mode', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
			throw new Error('EXIT')
		}) as never)
		const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

		expect(() => run(['api', 'projects', 'list', '--bogus'])).toThrow('EXIT')

		expect(stderrSpy).toHaveBeenCalled()
		expect(exitSpy).toHaveBeenCalledWith(1)
	})
})
