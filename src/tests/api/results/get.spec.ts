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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'results', 'get', ...args)

describe('mocked', () => {
	const mockResponse = { id: 10, tcaseId: 'tc1', status: 'failed', comment: '', links: [] }
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/result/:resultId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a result', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--result-id',
			'10'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastParams.resultId).toBe('10')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--result-id',
		'10',
	])

	test('rejects a non-positive result-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1', '--result-id', '0'),
			/--result-id.*must be a positive integer/
		)
	})
})

test('gets a result on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const created = await runCli<{ id: number }>(
		'api',
		'results',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--tcase-id',
		tcase.id,
		'--status',
		'failed'
	)
	const result = await runCommand<{ id: number; status: string }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--result-id',
		String(created.id)
	)
	expect(result.id).toBe(created.id)
	expect(result.status).toBe('failed')
})
