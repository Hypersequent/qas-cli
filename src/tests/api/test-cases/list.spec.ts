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
	testRejectsInvalidIdentifier,
	expectValidationError,
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

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects --page 0', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--page', '0'),
			/--page.*must be greater than 0/i
		)
	})
})

describe('live', { tags: ['live'] }, () => {
	function expectBaseFields(tcase: TCase) {
		expect(tcase).toHaveProperty('id')
		expect(tcase).toHaveProperty('legacyId')
		expect(tcase).toHaveProperty('version')
		expect(tcase).toHaveProperty('type')
		expect(tcase).toHaveProperty('title')
		expect(tcase).toHaveProperty('seq')
		expect(tcase).toHaveProperty('folderId')
		expect(tcase).toHaveProperty('pos')
		expect(tcase).toHaveProperty('priority')
		expect(tcase).toHaveProperty('authorId')
		expect(tcase).toHaveProperty('isDraft')
		expect(tcase).toHaveProperty('isLatestVersion')
		expect(tcase).toHaveProperty('isEmpty')
		expect(tcase).toHaveProperty('createdAt')
		expect(tcase).toHaveProperty('updatedAt')
	}

	test('lists test cases', async ({ project }) => {
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

		expect(result).toHaveProperty('total')
		expect(result).toHaveProperty('page')
		expect(result).toHaveProperty('limit')
		expect(Array.isArray(result.data)).toBe(true)
		expect(result.data.length).toBe(1)
		expectBaseFields(result.data[0])
	})

	test('lists test cases with include', async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		await createTCase(project.code, folderId)
		const result = await runCli<PaginatedResponse<TCase>>(
			'api',
			'test-cases',
			'list',
			'--project-code',
			project.code,
			'--include',
			'tags,requirements'
		)

		expect(result.data.length).toBe(1)
		const tcase = result.data[0]
		expectBaseFields(tcase)
		expect(Array.isArray(tcase.tags)).toBe(true)
		expect(Array.isArray(tcase.requirements)).toBe(true)
	})
})
