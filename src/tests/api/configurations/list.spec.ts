import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Configuration } from '../../../api/configurations'
import type { PaginatedResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'configurations', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [{ id: 'c1', title: 'Chrome', runCount: 2 }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/configuration/paginated`,
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

	test('lists configurations', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes include, pagination and sort params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--include',
			'runCount',
			'--offset',
			'5',
			'--sort-field',
			'created_at',
			'--sort-order',
			'desc'
		)
		expect(lastSearchParams!.getAll('include')).toEqual(['runCount'])
		expect(lastSearchParams!.get('offset')).toBe('5')
		expect(lastSearchParams!.get('sortField')).toBe('created_at')
		expect(lastSearchParams!.get('sortOrder')).toBe('desc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects an unknown include', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--include', 'runs'),
			/--include/
		)
	})
})

test('lists configurations on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Configuration>(
		'api',
		'configurations',
		'create',
		'--project-code',
		project.code,
		'--title',
		'CLI listed configuration'
	)
	const result = await runCommand<PaginatedResponse<Configuration>>(
		'--project-code',
		project.code,
		'--include',
		'runCount',
		'--limit',
		'100'
	)
	expect(result.data.find((c) => c.id === created.id)?.runCount).toBe(0)
})
