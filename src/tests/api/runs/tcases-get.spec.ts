import type { RunTCase } from '../../../api/runs'
import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'tcases', 'get', ...args)

describe('mocked', () => {
	const mockTCase = { id: 'tc1', title: 'Login test', seq: 1, status: 'open' }

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/tcase/:tcaseId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				return HttpResponse.json(mockTCase)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a test case in a run', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--tcase-id',
			'tc1'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastParams.tcaseId).toBe('tc1')
		expect(result).toEqual(mockTCase)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--tcase-id',
		'tc1',
	])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', [
		'--project-code',
		'PRJ',
		'--run-id',
		'1',
	])
})

test('gets a test case in a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const tcases = await runCli<RunTCase[]>(
		'api',
		'runs',
		'tcases',
		'list',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	const firstTcase = tcases[0]
	const result = await runCli<RunTCase>(
		'api',
		'runs',
		'tcases',
		'get',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--tcase-id',
		firstTcase.id
	)
	expect(result).toHaveProperty('id', firstTcase.id)
	expect(result).toHaveProperty('title')
})
