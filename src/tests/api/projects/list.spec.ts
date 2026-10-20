import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Project } from '../../../api/projects'
import type { PaginatedResponse } from '../../../api/schemas'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'projects', 'list', ...args)

describe('mocked', () => {
	const mockProjects = [
		{ id: 'p1', code: 'PRJ', title: 'Project 1' },
		{ id: 'p2', code: 'TST', title: 'Project 2' },
	]
	const mockResponse = { total: 2, offset: 0, limit: 100, data: mockProjects }

	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/paginated`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastSearchParams = null
	})

	test('lists projects', async () => {
		const result = await runCommand()
		expect(lastSearchParams?.toString()).toBe('')
		expect(result).toEqual(mockResponse)
	})

	test('passes pagination and sort params', async () => {
		await runCommand('--limit', '20', '--sort-field', 'updated_at', '--sort-order', 'desc')
		expect(lastSearchParams?.has('offset')).toBe(false)
		expect(lastSearchParams?.get('limit')).toBe('20')
		expect(lastSearchParams?.get('sortField')).toBe('updated_at')
		expect(lastSearchParams?.get('sortOrder')).toBe('desc')
	})
})

describe('validation errors', () => {
	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})

	test('rejects the removed --page option', async () => {
		await expectValidationError(() => runCommand('--page', '1'), /Unknown argument: page/)
	})
})

test('lists projects on live server', { tags: ['live'] }, async () => {
	const result = await runCommand<PaginatedResponse<Project>>()
	expect(result.data.length).toBe(Math.min(result.total, 100))
	for (const p of result.data) {
		expect(p).toHaveProperty('id')
		expect(p).toHaveProperty('code')
		expect(p).toHaveProperty('title')
	}
})
