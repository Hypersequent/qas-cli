import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'integrations', 'jira', 'issues', 'get', ...args)

describe('mocked', () => {
	const mockResponse = {
		issue: {
			id: '10394',
			key: 'QA-12',
			summary: 'Login fails',
			description: '',
			url: 'https://acme.atlassian.net/browse/QA-12',
		},
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/jira/:integrationId/issue/:issueId`,
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

	test('gets a Jira issue by key', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--issue-id',
			'QA-12'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.integrationId).toBe('1CSWAh3ys_YniqfXepnwT8F')
		expect(lastParams.issueId).toBe('QA-12')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
		'--issue-id',
		'QA-12',
	])
	testRejectsInvalidIdentifier(runCommand, 'issue-id', 'resource', [
		'--project-code',
		'PRJ',
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
	])
})
