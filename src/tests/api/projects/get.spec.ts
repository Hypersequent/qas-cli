import { HttpResponse, http } from 'msw'
import { describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidPathParam,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'projects', 'get', ...args)

describe('mocked', () => {
	const mockProject = { id: 'p1', code: 'PRJ', title: 'Project 1' }

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:codeOrId`, ({ params, request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			expect(params['codeOrId']).toEqual('PRJ')
			return HttpResponse.json(mockProject)
		})
	)

	test('gets a project by code', async () => {
		const result = await runCommand('--project-code', 'PRJ')
		expect(result).toEqual(mockProject)
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code')
})

test('gets a project on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand('--project-code', project.code)
	expect(result).toHaveProperty('code', project.code)
	expect(result).toHaveProperty('id')
	expect(result).toHaveProperty('title')
})
