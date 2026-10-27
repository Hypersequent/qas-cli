import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Report } from '../../../api/reports'
import type { PaginatedResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createReport,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'reports', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [{ id: 'r1', seq: 3, name: 'Scorecard', type: 'runScorecard' }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/report/paginated`,
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

	test('lists reports', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.toString()).toBe('')
		expect(result).toEqual(mockResponse)
	})

	test('passes filters, pagination and sort params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--report-types',
			'runScorecard, effort',
			'--user-ids',
			'1,2',
			'--created-after',
			'2026-10-01T00:00:00Z',
			'--created-before',
			'2026-11-01T00:00:00Z',
			'--limit',
			'20',
			'--sort-field',
			'type',
			'--sort-order',
			'asc'
		)
		expect(lastSearchParams!.getAll('reportTypes')).toEqual(['runScorecard', 'effort'])
		expect(lastSearchParams!.getAll('userIds')).toEqual(['1', '2'])
		expect(lastSearchParams!.get('createdAfter')).toBe('2026-10-01T00:00:00Z')
		expect(lastSearchParams!.get('createdBefore')).toBe('2026-11-01T00:00:00Z')
		expect(lastSearchParams!.get('limit')).toBe('20')
		expect(lastSearchParams!.get('sortField')).toBe('type')
		expect(lastSearchParams!.get('sortOrder')).toBe('asc')
	})

	test('leaves checking report types to the API', async ({ project }) => {
		await runCommand('--project-code', project.code, '--report-types', 'newType')
		expect(lastSearchParams!.getAll('reportTypes')).toEqual(['newType'])
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects user IDs that are not positive integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--user-ids', '1,x'),
			/--user-ids.*must be comma-separated positive integers/
		)
	})

	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})
})

test('lists reports on live server', { tags: ['live'] }, async ({ project }) => {
	const report = await createReport(project.code)
	const result = await runCommand<PaginatedResponse<Report>>('--project-code', project.code)
	expect(result.data.map((r) => r.id)).toContain(report.id)
})
