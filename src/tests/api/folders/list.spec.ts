import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Folder } from '../../../api/folders'
import type { PaginatedResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	createFolder,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		data: [{ id: 1, parentId: 0, pos: 0, title: 'Root' }],
		total: 1,
		offset: 0,
		limit: 25,
	}

	let lastUrl: URL | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/folders`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastUrl = new URL(request.url)
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastUrl = null
		lastParams = {}
	})

	test('lists folders', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes offset and limit as query parameters', async ({ project }) => {
		await runCommand('--project-code', project.code, '--offset', '10', '--limit', '5')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastUrl).not.toBeNull()
		expect(lastUrl!.searchParams.get('offset')).toEqual('10')
		expect(lastUrl!.searchParams.get('limit')).toEqual('5')
	})

	test('passes sort-field as query parameter', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--sort-field',
			'created_at',
			'--sort-order',
			'desc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastUrl).not.toBeNull()
		expect(lastUrl!.searchParams.get('sortField')).toEqual('created_at')
		expect(lastUrl!.searchParams.get('sortOrder')).toEqual('desc')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects invalid sort-field value', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--sort-field', 'invalid_field'),
			/sort-field|choices|invalid_field/i
		)
	})

	test('rejects --page with non-integer', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--page', '1.5'),
			/--page.*expected int/i
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
})

test('lists folders on live server', { tags: ['live'] }, async ({ project }) => {
	await createFolder(project.code)
	const result = await runCli<PaginatedResponse<Folder>>(
		'api',
		'folders',
		'list',
		'--project-code',
		project.code
	)
	expect(result).toHaveProperty('data')
	expect(Array.isArray(result.data)).toBe(true)
	expect(result.data.length).toBeGreaterThanOrEqual(1)
})
