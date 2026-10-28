import type { RunTCase } from '../../../api/runs'
import type { PaginatedResponse } from '../../../api/schemas'
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
	runCli<T>('api', 'runs', 'test-cases', 'list', ...args)

describe('mocked', () => {
	const mockTCases = [{ id: 'tc1', title: 'Test', seq: 1 }]
	const mockResponse = { total: 1, offset: 0, limit: 100, data: mockTCases }

	let lastUrl: URL | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/tcase/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastUrl = new URL(request.url)
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastUrl = null
		lastParams = {}
	})

	test('lists test cases in a run', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual({ total: 1, offset: 0, limit: 100, data: mockTCases })
	})

	test('passes include and pagination params as query parameters', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--include',
			'folder, steps',
			'--offset',
			'10',
			'--sort-field',
			'status'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastUrl).not.toBeNull()
		expect(lastUrl!.searchParams.getAll('include')).toEqual(['folder', 'steps'])
		expect(lastUrl!.searchParams.get('offset')).toEqual('10')
		expect(lastUrl!.searchParams.has('limit')).toBe(false)
		expect(lastUrl!.searchParams.get('sortField')).toEqual('status')
		expect(result).toEqual(mockResponse)
	})

	test('passes status and automation result filters', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--status',
			'failed,blocked',
			'--automation-results',
			'automated_failing',
			'--automation-results-filter-op',
			'not',
			'--tags',
			'1,2',
			'--tags-filter-op',
			'and'
		)
		expect(lastUrl!.searchParams.getAll('status')).toEqual(['failed', 'blocked'])
		expect(lastUrl!.searchParams.getAll('automationResults')).toEqual(['automated_failing'])
		expect(lastUrl!.searchParams.get('automationResultsFilterOp')).toEqual('not')
		expect(lastUrl!.searchParams.getAll('tags')).toEqual(['1', '2'])
		expect(lastUrl!.searchParams.get('tagsFilterOp')).toEqual('and')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--run-id', '1'])
})

describe('live', { tags: ['live'] }, () => {
	test('lists test cases in a run', async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const tcase = await createTCase(project.code, folderId)
		const run = await createRun(project.code, [tcase.id])
		const result = await runCli<PaginatedResponse<RunTCase>>(
			'api',
			'runs',
			'test-cases',
			'list',
			'--project-code',
			project.code,
			'--run-id',
			String(run.id)
		)
		expect(result.total).toBe(1)
		expect(result.data.length).toBe(1)
	})

	test('lists test cases in a run with include', async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const tcase = await createTCase(project.code, folderId)
		const run = await createRun(project.code, [tcase.id])
		const result = await runCli<PaginatedResponse<RunTCase>>(
			'api',
			'runs',
			'test-cases',
			'list',
			'--project-code',
			project.code,
			'--run-id',
			String(run.id),
			'--include',
			'folder'
		)
		expect(result.data.length).toBe(1)
		const rtcase = result.data[0]
		expect(rtcase).toHaveProperty('folder')
		expect(rtcase.folder).toHaveProperty('id')
		expect(rtcase.folder).toHaveProperty('title')
	})
})
