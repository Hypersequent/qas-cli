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
	runCli<T>('api', 'integrations', 'get', ...args)

describe('mocked', () => {
	const mockResponse = {
		id: '1CSWAh3ys_YniqfXepnwT8F',
		name: 'Acme Jira',
		type: 'jira',
		config: {},
		relationConfig: {},
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/:integrationId`,
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

	test('gets an integration', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.integrationId).toBe('1CSWAh3ys_YniqfXepnwT8F')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
	])
	testRejectsInvalidIdentifier(runCommand, 'integration-id', 'resource', ['--project-code', 'PRJ'])
})
