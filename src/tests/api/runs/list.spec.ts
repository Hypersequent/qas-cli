import type { Run } from '../../../api/runs'
import type { PaginatedResponse } from '../../../api/schemas'
import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	expectValidationError,
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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'list', ...args)

describe('mocked', () => {
	const mockRuns = [{ id: 1, title: 'Run 1', type: 'static', closed: false }]

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json({ total: 1, offset: 0, limit: 100, data: mockRuns })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists runs in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ total: 1, offset: 0, limit: 100, data: mockRuns })
	})

	test('passes filter params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--closed',
			'--milestone-ids',
			'1,2',
			'--include',
			'statusCounts, milestone',
			'--limit',
			'10',
			'--sort-field',
			'last_activity_at'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams).not.toBeNull()
		expect(lastSearchParams!.get('closed')).toBe('true')
		expect(lastSearchParams!.getAll('milestoneIds')).toEqual(['1', '2'])
		expect(lastSearchParams!.getAll('include')).toEqual(['statusCounts', 'milestone'])
		expect(lastSearchParams!.get('limit')).toBe('10')
		expect(lastSearchParams!.get('sortField')).toBe('last_activity_at')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})
})

test('lists runs on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const result = await runCli<PaginatedResponse<Run>>(
		'api',
		'runs',
		'list',
		'--project-code',
		project.code,
		'--include',
		'statusCounts'
	)
	expect(result.data.find((r) => r.id === run.id)?.statusCounts?.open).toBe(1)
})
