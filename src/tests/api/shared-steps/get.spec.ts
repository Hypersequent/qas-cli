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
	runCli<T>('api', 'shared-steps', 'get', ...args)

describe('mocked', () => {
	const mockData = { id: 1, title: 'Login steps' }

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/shared-step/:id`,
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

	test('gets a shared step', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--id', '1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('1')
		expect(result).toEqual(mockData)
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code', ['--id', '1'])
})
