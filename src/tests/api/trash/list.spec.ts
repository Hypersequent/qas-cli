import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { PaginatedResponse } from '../../../api/schemas'
import type { TrashEntry } from '../../../api/trash'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'trash', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		total: 1,
		offset: 0,
		limit: 100,
		data: [
			{
				id: '1CJo8oDjj_vkGo2rQAdzz4F',
				name: 'Folder Login (3 test cases)',
				resourceType: 'test_case',
				authorId: 1,
				author: { id: 1, name: 'Jane' },
				items: [
					{
						seq: 1,
						folderIds: [4],
						tcaseIds: null,
						runIds: null,
						planIds: null,
						milestoneIds: null,
					},
				],
				createdAt: '2025-01-15T10:30:00Z',
			},
		],
	}

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/trash/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists trash entries', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams?.toString()).toBe('')
		expect(result).toEqual(mockResponse)
	})

	test('passes filters and pagination', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--resource-types',
			'test_case, test_run',
			'--offset',
			'10',
			'--limit',
			'5',
			'--sort-order',
			'asc'
		)
		expect(lastSearchParams?.getAll('resourceTypes')).toEqual(['test_case', 'test_run'])
		expect(lastSearchParams?.get('offset')).toBe('10')
		expect(lastSearchParams?.get('limit')).toBe('5')
		expect(lastSearchParams?.get('sortOrder')).toBe('asc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects an unknown resource type', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--resource-types', 'test_case,folder'),
			/--resource-types.*must be comma-separated values of test_case, test_run, test_plan, milestone/
		)
	})

	test('rejects a negative offset', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--offset', '-1'),
			/--offset/
		)
	})
})

test('lists trash entries on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<PaginatedResponse<TrashEntry>>(
		'--project-code',
		project.code,
		'--resource-types',
		'test_case'
	)
	expect(result).toHaveProperty('total')
	expect(Array.isArray(result.data)).toBe(true)
	for (const entry of result.data) {
		expect(entry.resourceType).toBe('test_case')
	}
})
