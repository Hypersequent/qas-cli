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
	runCli<T>('api', 'integrations', 'jira', 'issues', 'search', ...args)

describe('mocked', () => {
	const mockResponse = {
		data: [
			{
				id: '10394',
				key: 'QA-12',
				summary: 'Login fails',
				description: '',
				url: 'https://acme.atlassian.net/browse/QA-12',
			},
		],
		nextPageToken: 'next',
		isLast: false,
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/jira/:integrationId/issue`,
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

	test('searches Jira issues', async ({ project }) => {
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
			'--types',
			'Bug,Story',
			'--fields',
			'summary,description',
			'--limit',
			'50',
			'--next-page-token',
			'next',
			'--sort-field',
			'key',
			'--sort-order',
			'desc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.get('search')).toBe('login')
		expect(lastSearchParams!.getAll('types')).toEqual(['Bug', 'Story'])
		expect(lastSearchParams!.getAll('fields')).toEqual(['summary', 'description'])
		expect(lastSearchParams!.get('limit')).toBe('50')
		expect(lastSearchParams!.get('nextPageToken')).toBe('next')
		expect(lastSearchParams!.get('sortField')).toBe('key')
		expect(lastSearchParams!.get('sortOrder')).toBe('desc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
	])

	test('rejects a limit above 5000', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--integration-id',
					'1CSWAh3ys_YniqfXepnwT8F',
					'--limit',
					'5001'
				),
			/--limit.*must be at most 5000/
		)
	})
})
