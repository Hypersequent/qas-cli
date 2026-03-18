import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'list', ...args)

describe('mocked', () => {
	const mockTags = [
		{ id: 1, title: 'smoke' },
		{ id: 2, title: 'regression' },
	]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/tag`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			return HttpResponse.json({ tags: mockTags })
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists tags in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockTags)
	})
})
