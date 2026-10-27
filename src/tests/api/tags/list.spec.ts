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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'list', ...args)

describe('mocked', () => {
	const mockTags = [
		{ id: 1, title: 'smoke' },
		{ id: 2, title: 'regression' },
	]

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/tag/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json({ total: 2, offset: 0, limit: 100, data: mockTags })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists tags in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ total: 2, offset: 0, limit: 100, data: mockTags })
	})

	test('passes include as a query parameter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--include', 'tcaseCount')
		expect(lastSearchParams?.get('include')).toBe('tcaseCount')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})
