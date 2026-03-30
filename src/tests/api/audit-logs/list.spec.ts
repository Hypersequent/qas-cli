import { HttpResponse, http } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'audit-logs', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		after: 0,
		count: 1,
		events: [{ id: 'log1', action: 'create', timestamp: '2024-01-01T00:00:00Z', userId: 'u1' }],
	}

	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/audit-logs`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastSearchParams = null
	})

	test('lists audit logs', async () => {
		const result = await runCommand()
		expect(result).toEqual(mockResponse)
	})

	test('passes pagination params', async () => {
		await runCommand('--after', '100', '--count', '10')
		expect(lastSearchParams).not.toBeNull()
		expect(lastSearchParams!.get('after')).toBe('100')
		expect(lastSearchParams!.get('count')).toBe('10')
	})
})

describe('validation errors', () => {
	test('rejects --after -1', async () => {
		await expectValidationError(
			() => runCommand('--after', '-1'),
			/--after.*must be greater than or equal to 0/i
		)
	})

	test('rejects --count 0', async () => {
		await expectValidationError(
			() => runCommand('--count', '0'),
			/--count.*must be greater than 0/i
		)
	})
})
