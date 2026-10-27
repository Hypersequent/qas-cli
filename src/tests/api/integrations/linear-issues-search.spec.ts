import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'integrations', 'linear', 'issues', 'search', ...args)

describe('mocked', () => {
	const mockResponse = {
		data: [
			{
				id: 'l1',
				identifier: 'ENG-34',
				title: 'Login fails',
				url: 'https://linear.app/acme/issue/ENG-34',
			},
		],
		nextPageToken: null,
		isLast: true,
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/linear/:integrationId/issue`,
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

	test('searches Linear issues', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes the search params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--search',
			'login',
			'--limit',
			'20',
			'--next-page-token',
			'abc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.get('search')).toBe('login')
		expect(lastSearchParams!.get('limit')).toBe('20')
		expect(lastSearchParams!.get('nextPageToken')).toBe('abc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
	])

	test('rejects a limit above 250', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--integration-id',
					'1CSWAh3ys_YniqfXepnwT8F',
					'--limit',
					'251'
				),
			/--limit.*must be at most 250/
		)
	})
})
