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
	runCli<T>('api', 'integrations', 'github', 'issues', 'get', ...args)

describe('mocked', () => {
	const mockResponse = {
		issue: {
			id: 1012,
			number: 12,
			title: 'Login fails',
			body: '',
			url: 'https://github.com/acme/app/issues/12',
		},
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/github/:integrationId/issue/:issueNumber`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a GitHub issue by number', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--issue-number',
			'12'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.issueNumber).toBe('12')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
		'--issue-number',
		'12',
	])

	test('rejects a non-positive issue-number', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--integration-id',
					'1CSWAh3ys_YniqfXepnwT8F',
					'--issue-number',
					'0'
				),
			/--issue-number.*must be a positive integer/
		)
	})
})
