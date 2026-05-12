import { describe, test, expect, vi } from 'vitest'
import { withBaseUrl } from '../../api/utils'

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
