import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { TCase } from '../../../api/tcases'
import type { PaginatedResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'list', ...args)

describe('mocked', () => {
	const mockResponse = { data: [{ id: 'tc1', title: 'Test' }], total: 1, page: 1, limit: 25 }

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/tcase`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists test cases', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes filter params', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--folders',
			'1,2',
			'--priorities',
			'high',
			'--search',
			'login'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams).not.toBeNull()
		expect(lastSearchParams!.get('priorities')).toBe('high')
		expect(lastSearchParams!.get('search')).toBe('login')
		expect(lastSearchParams!.getAll('folders')).toEqual(['1', '2'])
	})
})

test('lists test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	await createTCase(project.code, folderId)
	const result = await runCli<PaginatedResponse<TCase>>(
		'api',
		'test-cases',
		'list',
		'--project-code',
		project.code
	)
	expect(result).toHaveProperty('data')
	expect(Array.isArray(result.data)).toBe(true)
	expect(result.data.length).toBeGreaterThanOrEqual(1)
})
