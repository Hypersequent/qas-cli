import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TCaseResult } from '../../../api/tcases'
import type { PaginatedResponse } from '../../../api/schemas'
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
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'results', 'list', ...args)

describe('mocked', () => {
	const response = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [{ id: 1, status: 'passed', tcaseId: 'tc1' }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/:id/result/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json(response)
			}
		)
	)

	beforeEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists the results of a test case', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--tcase-id', 'tc1')
		expect(lastParams).toEqual({ projectCode: project.code, id: 'tc1' })
		expect(result).toEqual(response)
	})

	test('passes filters and includes', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--tcase-id',
			'12',
			'--offset',
			'10',
			'--limit',
			'5',
			'--sort-order',
			'asc',
			'--include',
			'run,author',
			'--exclude-status',
			'open, skipped',
			'--created-after',
			'2026-01-01T00:00:00Z',
			'--internal',
			'false'
		)
		expect(lastSearchParams?.get('offset')).toBe('10')
		expect(lastSearchParams?.get('limit')).toBe('5')
		expect(lastSearchParams?.get('sortOrder')).toBe('asc')
		expect(lastSearchParams?.getAll('include')).toEqual(['run', 'author'])
		expect(lastSearchParams?.getAll('excludeStatus')).toEqual(['open', 'skipped'])
		expect(lastSearchParams?.get('createdAfter')).toBe('2026-01-01T00:00:00Z')
		expect(lastSearchParams?.get('internal')).toBe('false')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--tcase-id', 'tc1'])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', ['--project-code', 'PRJ'])

	test('rejects an unknown include', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-id', 'tc1', '--include', 'steps'),
			/include/
		)
	})
})

test('lists the results of a test case on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const created = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [created.id])
	await runCli(
		'api',
		'results',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--tcase-id',
		created.id,
		'--status',
		'passed'
	)
	const result = await runCommand<PaginatedResponse<TCaseResult>>(
		'--project-code',
		project.code,
		'--tcase-id',
		created.id,
		'--include',
		'run'
	)
	expect(result.data.some((r) => r.status === 'passed' && r.run?.id === run.id)).toBe(true)
})
