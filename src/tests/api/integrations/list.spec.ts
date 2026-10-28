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
	runCli<T>('api', 'integrations', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		integrations: [
			{
				id: '1CSWAh3ys_YniqfXepnwT8F',
				name: 'Acme Jira',
				type: 'jira',
				config: { url: 'https://acme.atlassian.net' },
				relationConfig: { projectId: '10000' },
			},
		],
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/integration`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test("lists a project's integrations", async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [])
})

test("lists a project's integrations on live server", { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<{ integrations: unknown[] }>('--project-code', project.code)
	expect(result.integrations).toEqual([])
})
