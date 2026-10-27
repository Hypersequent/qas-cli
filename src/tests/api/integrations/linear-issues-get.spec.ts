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
	runCli<T>('api', 'integrations', 'linear', 'issues', 'get', ...args)

describe('mocked', () => {
	const mockResponse = {
		issue: {
			id: 'l1',
			identifier: 'ENG-34',
			title: 'Login fails',
			url: 'https://linear.app/acme/issue/ENG-34',
		},
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/linear/:integrationId/issue/:issueId`,
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

	test('gets a Linear issue by identifier', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--issue-id',
			'ENG-34'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.issueId).toBe('ENG-34')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
		'--issue-id',
		'ENG-34',
	])
	testRejectsInvalidIdentifier(runCommand, 'issue-id', 'resource', [
		'--project-code',
		'PRJ',
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
	])
})
