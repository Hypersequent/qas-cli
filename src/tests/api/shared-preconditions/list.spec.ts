import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidPathParam,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-preconditions', 'list', ...args)

describe('mocked', () => {
	const mockData = [{ id: 1, title: 'User is logged in' }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/shared-precondition`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				return HttpResponse.json(mockData)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists shared preconditions', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockData)
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code')
})
