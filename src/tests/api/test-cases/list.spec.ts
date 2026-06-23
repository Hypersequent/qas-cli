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
	const mockResponse = { data: [{ id: 'tc1', title: 'Test' }], total: 1, offset: 0, limit: 25 }

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/tcase`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
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

	test('passes offset and limit as query parameters', async ({ project }) => {
		await runCommand('--project-code', project.code, '--offset', '20', '--limit', '10')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams).not.toBeNull()
		expect(lastSearchParams!.get('offset')).toBe('20')
		expect(lastSearchParams!.get('limit')).toBe('10')
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
			/--page.*expected number to be >0/i
		)
	})

	test('rejects --page -1', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--page', '-1'),
			/--page.*expected number to be >0/i
		)
	})

	test('rejects --offset -1', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--offset', '-1'),
			/--offset.*expected number to be >=0/i
		)
	})

	test('rejects --limit -1', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--limit', '-1'),
			/--limit.*expected number to be >=0/i
		)
	})

	test('rejects invalid --sort-order', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--sort-order', 'invalid'),
			/sort-order.*Choices.*asc.*desc/
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
