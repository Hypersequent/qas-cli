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
	runCli<T>('api', 'requirements', 'list', ...args)

describe('mocked', () => {
	const mockRequirements = [{ id: 1, text: 'User can login' }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/requirement`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			return HttpResponse.json({ requirements: mockRequirements })
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists requirements', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockRequirements)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})
