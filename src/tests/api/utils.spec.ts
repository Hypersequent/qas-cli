import { describe, test, expect, vi } from 'vitest'
import { fetchAllPages, jsonResponse, withBaseUrl } from '../../api/utils'

describe('fetchAllPages', () => {
	const pagesOf = (total: number) =>
		vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
			total,
			offset,
			limit,
			data: Array.from(
				{ length: Math.max(0, Math.min(limit, total - offset)) },
				(_, i) => offset + i
			),
		}))

	test.each([
		{ total: 0, calls: 1 },
		{ total: 999, calls: 1 },
		{ total: 1000, calls: 1 },
		{ total: 2500, calls: 3 },
	])('reads $total items in $calls requests', async ({ total, calls }) => {
		const fetchPage = pagesOf(total)
		const result = await fetchAllPages(fetchPage)
		expect(result).toEqual({ total, data: Array.from({ length: total }, (_, i) => i) })
		expect(fetchPage).toHaveBeenCalledTimes(calls)
		expect(fetchPage.mock.calls.map(([page]) => page)).toEqual(
			Array.from({ length: calls }, (_, i) => ({ offset: i * 1000, limit: 1000 }))
		)
	})
})

describe('withBaseUrl', () => {
	test('strips trailing slashes from base URL', async () => {
		const mockFetcher = vi.fn().mockResolvedValue(new Response('ok'))
		const fetcher = withBaseUrl('https://host.com/')(mockFetcher as unknown as typeof fetch)
		await fetcher('/api/test')
		expect(mockFetcher).toHaveBeenCalledWith('https://host.com/api/test', undefined)
	})

	test('strips multiple trailing slashes', async () => {
		const mockFetcher = vi.fn().mockResolvedValue(new Response('ok'))
		const fetcher = withBaseUrl('https://host.com///')(mockFetcher as unknown as typeof fetch)
		await fetcher('/api/test')
		expect(mockFetcher).toHaveBeenCalledWith('https://host.com/api/test', undefined)
	})

	test('works with base URL without trailing slash', async () => {
		const mockFetcher = vi.fn().mockResolvedValue(new Response('ok'))
		const fetcher = withBaseUrl('https://host.com')(mockFetcher as unknown as typeof fetch)
		await fetcher('/api/test')
		expect(mockFetcher).toHaveBeenCalledWith('https://host.com/api/test', undefined)
	})
})

describe('jsonResponse', () => {
	test('returns the body of a successful response', async () => {
		await expect(jsonResponse(new Response('{"id": 1}', { status: 200 }))).resolves.toEqual({
			id: 1,
		})
	})

	test('throws the message of an error response', async () => {
		const response = new Response('{"message": "run not found"}', { status: 404 })
		await expect(jsonResponse(response)).rejects.toThrow('run not found')
	})

	test('throws the status text of an error response without a JSON body', async () => {
		const response = new Response('<html>Gateway Timeout</html>', {
			status: 504,
			statusText: 'Gateway Timeout',
		})
		await expect(jsonResponse(response)).rejects.toThrow('Gateway Timeout')
	})
})
