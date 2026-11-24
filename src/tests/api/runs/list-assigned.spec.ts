import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { PaginatedResponse } from '../../../api/schemas'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'list-assigned', ...args)

describe('mocked', () => {
	const mockResponse = { total: 1, offset: 0, limit: 100, data: [{ id: 42, title: 'Sprint 1' }] }
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/run/assigned/paginated`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastSearchParams = null
	})

	test('lists the runs assigned to you', async () => {
		const result = await runCommand()
		expect(result).toEqual(mockResponse)
	})

	test('passes pagination and sort params', async () => {
		await runCommand(
			'--offset',
			'10',
			'--limit',
			'20',
			'--sort-field',
			'last_activity_at',
			'--sort-order',
			'asc'
		)
		expect(lastSearchParams!.get('offset')).toBe('10')
		expect(lastSearchParams!.get('limit')).toBe('20')
		expect(lastSearchParams!.get('sortField')).toBe('last_activity_at')
		expect(lastSearchParams!.get('sortOrder')).toBe('asc')
	})
})

describe('validation errors', () => {
	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() => runCommand('--limit', '1001'),
			/--limit.*must be at most 1000/
		)
	})
})

test('lists the runs assigned to you on live server', { tags: ['live'] }, async () => {
	const result = await runCommand<PaginatedResponse<{ id: number }>>('--limit', '1')
	expect(Array.isArray(result.data)).toBe(true)
})
