import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'
import { withHttpRetry } from '../api/utils'

beforeEach(() => {
	vi.useFakeTimers()
})

afterEach(() => {
	vi.useRealTimers()
})

const mockFetch = (responses: Array<{ status: number; headers?: Record<string, string> }>) => {
	let callCount = 0
	const fn = vi.fn(async () => {
		const response = responses[callCount] || responses[responses.length - 1]
		callCount++
		return new Response(JSON.stringify({}), {
			status: response.status,
			headers: response.headers,
		})
	}) as unknown as typeof fetch
	return fn
}

const advanceRetryTimers = async () => {
	// Flush microtasks then advance timers repeatedly to handle retry delays
	await vi.advanceTimersByTimeAsync(60_000)
}

describe('withHttpRetry', () => {
	test('passes through successful responses without retry', async () => {
		const fetcher = mockFetch([{ status: 200 }])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const response = await retryFetcher('https://example.com/api')

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(1)
	})

	test('passes through non-retryable error responses without retry', async () => {
		const fetcher = mockFetch([{ status: 400 }])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const response = await retryFetcher('https://example.com/api')

		expect(response.status).toBe(400)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(1)
	})

	test('retries on 429 and eventually succeeds', async () => {
		const fetcher = mockFetch([{ status: 429 }, { status: 429 }, { status: 200 }])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')
		await advanceRetryTimers()
		const response = await promise

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(3)
	})

	test('retries on 502 and 503', async () => {
		const fetcher = mockFetch([{ status: 502 }, { status: 503 }, { status: 200 }])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')
		await advanceRetryTimers()
		const response = await promise

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(3)
	})

	test('returns last response after exhausting max retries', async () => {
		const fetcher = mockFetch([
			{ status: 429 },
			{ status: 429 },
			{ status: 429 },
			{ status: 429 },
			{ status: 429 },
			{ status: 429 },
		])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')
		await advanceRetryTimers()
		const response = await promise

		expect(response.status).toBe(429)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(6) // 1 initial + 5 retries
	})

	test('respects Retry-After header', async () => {
		const fetcher = mockFetch([{ status: 429, headers: { 'Retry-After': '3' } }, { status: 200 }])
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')

		// Should not have retried yet at 2.9s
		await vi.advanceTimersByTimeAsync(2900)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(1)

		// Should retry after 3s
		await vi.advanceTimersByTimeAsync(200)
		const response = await promise

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(2)
	})

	test('respects Retry-After header with HTTP-date', async () => {
		// Use a dynamic mock so the date is computed relative to the faked Date.now()
		// at the time the response is created, not at test setup time
		let callCount = 0
		const fetcher = vi.fn(async () => {
			callCount++
			if (callCount === 1) {
				const futureDate = new Date(Date.now() + 5000).toUTCString()
				return new Response(JSON.stringify({}), {
					status: 429,
					headers: { 'Retry-After': futureDate },
				})
			}
			return new Response(JSON.stringify({}), { status: 200 })
		}) as unknown as typeof fetch
		const retryFetcher = withHttpRetry(fetcher, { jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')

		// toUTCString() has second-level precision, so up to 999ms can be lost.
		// With a 5s target, actual delay is between ~4001ms and ~5000ms.
		// Check at 3.9s (safely before minimum) and advance past 5s.
		await vi.advanceTimersByTimeAsync(3900)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(1)

		await vi.advanceTimersByTimeAsync(1200)
		const response = await promise

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(2)
	})

	test('uses exponential backoff with correct delays', async () => {
		const fetcher = mockFetch([{ status: 429 }, { status: 429 }, { status: 429 }, { status: 200 }])
		const retryFetcher = withHttpRetry(fetcher, {
			jitterFraction: 0,
			baseDelayMs: 1000,
			backoffFactor: 2,
		})

		const promise = retryFetcher('https://example.com/api')

		// After 999ms — still only 1 call
		await vi.advanceTimersByTimeAsync(999)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(1)

		// After 1000ms — 2nd call
		await vi.advanceTimersByTimeAsync(1)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(2)

		// After 1999ms more — still only 2 calls (need 2000ms for 2nd retry)
		await vi.advanceTimersByTimeAsync(1999)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(2)

		// After 1ms more (total 2000ms) — 3rd call
		await vi.advanceTimersByTimeAsync(1)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(3)

		// After 4000ms — 4th call (success)
		await vi.advanceTimersByTimeAsync(4000)
		const response = await promise

		expect(response.status).toBe(200)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(4)
	})

	test('respects custom maxRetries option', async () => {
		const fetcher = mockFetch([{ status: 429 }, { status: 429 }, { status: 429 }])
		const retryFetcher = withHttpRetry(fetcher, { maxRetries: 2, jitterFraction: 0 })

		const promise = retryFetcher('https://example.com/api')
		await advanceRetryTimers()
		const response = await promise

		expect(response.status).toBe(429)
		expect(vi.mocked(fetcher)).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
	})
})
