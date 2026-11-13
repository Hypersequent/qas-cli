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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'get', ...args)

describe('mocked', () => {
	const mockResponse = { id: 42, title: 'Sprint 1', type: 'static', closedAt: null }
	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/run/:runId`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a run', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual(mockResponse)
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
})

test('gets a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const result = await runCommand<{ id: number; closedAt: string | null }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(result.id).toBe(run.id)
	expect(result.closedAt).toBeNull()
})
