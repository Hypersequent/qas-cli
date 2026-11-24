import { describe, test, expect, vi } from 'vitest'
import { fetchAllPages, iteratePages, jsonResponse, withBaseUrl } from '../../api/utils'

describe('fetchAllPages', () => {
	// `cap` is the most rows the server returns in a page, whatever limit it is asked for
	const pagesOf = (total: number, cap = Infinity) =>
		vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
			total,
			offset,
			limit: Math.min(limit, cap),
			data: Array.from(
				{ length: Math.max(0, Math.min(limit, cap, total - offset)) },
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
		expect(result).toEqual(Array.from({ length: total }, (_, i) => i))
		expect(fetchPage).toHaveBeenCalledTimes(calls)
		expect(fetchPage.mock.calls.map(([page]) => page)).toEqual(
			Array.from({ length: calls }, (_, i) => ({ offset: i * 1000, limit: 1000 }))
		)
	})

	test('reads every item when the server returns shorter pages than asked for', async () => {
		const fetchPage = pagesOf(250, 100)
		expect(await fetchAllPages(fetchPage)).toEqual(Array.from({ length: 250 }, (_, i) => i))
		expect(fetchPage.mock.calls.map(([page]) => page.offset)).toEqual([0, 100, 200])
	})

	test('stops at an empty page, even short of the reported total', async () => {
		const fetchPage = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
			total: 10,
			offset,
			limit,
			data: offset === 0 ? [0, 1, 2] : [],
		}))
		expect(await fetchAllPages(fetchPage)).toEqual([0, 1, 2])
		expect(fetchPage).toHaveBeenCalledTimes(2)
	})
})

describe('iteratePages', () => {
	test('fetches a page only when the previous one has been consumed', async () => {
		const fetchPage = vi.fn(async ({ offset, limit }: { offset: number; limit: number }) => ({
			total: 3000,
			offset,
			limit,
			data: Array.from({ length: limit }, (_, i) => offset + i),
		}))
		for await (const page of iteratePages(fetchPage)) {
			expect(page).toHaveLength(1000)
			break
		}
		expect(fetchPage).toHaveBeenCalledTimes(1)
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
