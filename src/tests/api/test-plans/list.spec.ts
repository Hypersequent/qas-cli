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
	createTestPlan,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-plans', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [{ id: 1, title: 'Release', milestoneId: null, closedAt: null }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/plan/paginated`,
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

	test('lists test plans', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes filters, pagination and sort params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--closed',
			'false',
			'--milestone-ids',
			'1,2',
			'--limit',
			'20',
			'--sort-field',
			'closed_at',
			'--sort-order',
			'asc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.get('closed')).toBe('false')
		expect(lastSearchParams!.getAll('milestoneIds')).toEqual(['1', '2'])
		expect(lastSearchParams!.get('limit')).toBe('20')
		expect(lastSearchParams!.get('sortField')).toBe('closed_at')
		expect(lastSearchParams!.get('sortOrder')).toBe('asc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [])

	test('rejects milestone IDs that are not positive integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--milestone-ids', '1,x'),
			/--milestone-ids.*must be comma-separated positive integers/
		)
	})

	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})
})

test('lists test plans on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	const result = await runCommand<{ data: { id: number }[] }>('--project-code', project.code)
	expect(result.data.map((p) => p.id)).toContain(plan.id)
})
