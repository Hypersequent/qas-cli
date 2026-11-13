import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createFolder,
	createTCase,
	createRun,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'logs', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [{ id: 'l1', runId: 42, comment: 'Deploy finished' }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/log/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test("lists a run's logs", async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual(mockResponse)
	})

	test('passes pagination and sort params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--offset',
			'5',
			'--limit',
			'10',
			'--sort-field',
			'api_key_id',
			'--sort-order',
			'asc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.get('offset')).toBe('5')
		expect(lastSearchParams!.get('limit')).toBe('10')
		expect(lastSearchParams!.get('sortField')).toBe('api_key_id')
		expect(lastSearchParams!.get('sortOrder')).toBe('asc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--run-id', '1'])

	test('rejects a non-positive run-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '0'),
			/--run-id.*must be a positive integer/
		)
	})

	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1', '--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})
})

test("lists a run's logs on live server", { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const log = await runCli<{ id: string }>(
		'api',
		'runs',
		'logs',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--comment',
		'CLI log'
	)
	const result = await runCommand<{ data: { id: string }[] }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(result.data.map((l) => l.id)).toContain(log.id)
})
