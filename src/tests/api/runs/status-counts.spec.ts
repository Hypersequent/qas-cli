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
	runCli<T>('api', 'runs', 'status-counts', ...args)

describe('mocked', () => {
	const mockResponse = { statusCounts: { open: 1, passed: 0 } }
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/status-counts`,
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

	test('counts the test cases of a run by status', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual(mockResponse)
	})

	test('passes the test case filters', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--search',
			'login',
			'--tags',
			'1,2',
			'--tags-filter-op',
			'and',
			'--priorities',
			'high',
			'--status',
			'failed,blocked',
			'--automation-results',
			'automated_failing,has_manual',
			'--automation-results-filter-op',
			'or'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.get('search')).toBe('login')
		expect(lastSearchParams!.getAll('tags')).toEqual(['1', '2'])
		expect(lastSearchParams!.get('tagsFilterOp')).toBe('and')
		expect(lastSearchParams!.getAll('priorities')).toEqual(['high'])
		expect(lastSearchParams!.getAll('status')).toEqual(['failed', 'blocked'])
		expect(lastSearchParams!.getAll('automationResults')).toEqual([
			'automated_failing',
			'has_manual',
		])
		expect(lastSearchParams!.get('automationResultsFilterOp')).toBe('or')
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

	test('rejects an unknown automation result filter', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1', '--automation-results', 'flaky'),
			/--automation-results/
		)
	})
})

test('counts the test cases of a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const result = await runCommand<{ statusCounts: Record<string, number> }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(result.statusCounts.open).toBe(1)
})
