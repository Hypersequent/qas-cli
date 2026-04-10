type FetchMiddleware = (fetcher: typeof fetch) => typeof fetch

// TODO: Each middleware adds a frame to the stack trace. V8 defaults to 10 frames (Error.stackTraceLimit).
// With too many middlewares, the call site gets truncated from the stack, making it hard to identify where the request originated.
// Currently at ~4 middlewares which fits within the limit.
export const withFetchMiddlewares = (
	fetcher: typeof fetch,
	...middlewares: FetchMiddleware[]
): typeof fetch => middlewares.reduce((f, mw) => mw(f), fetcher)

export const withBaseUrl =
	(baseUrl: string): FetchMiddleware =>
	(fetcher: typeof fetch): typeof fetch => {
		const normalized = baseUrl.replace(/\/+$/, '')
		return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
			if (typeof input === 'string') {
				return fetcher(normalized + input, init)
			}
			return fetcher(input, init)
		}
	}

export const withJson: FetchMiddleware = (fetcher) => {
	const JSON_CONFIG: RequestInit = {
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
	}

	return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		return fetcher(input, {
			...init,
			headers: {
				...JSON_CONFIG.headers,
				...init?.headers,
			},
		})
	}
}

export const withHeaders = (
	fetcher: typeof fetch,
	headers: Record<string, string>
): typeof fetch => {
	return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		return fetcher(input, {
			...init,
			headers: {
				...headers,
				...init?.headers,
			},
		})
	}
}

export const withUserAgent =
	(version: string): FetchMiddleware =>
	(fetcher) =>
		withHeaders(fetcher, { 'User-Agent': `qas-cli/${version}` })

export type AuthType = 'apikey' | 'bearer'

export const withAuth =
	(token: string, authType: AuthType): FetchMiddleware =>
	(fetcher) =>
		withHeaders(fetcher, {
			Authorization: authType === 'bearer' ? `Bearer ${token}` : `ApiKey ${token}`,
		})

export const jsonResponse = async <T>(response: Response): Promise<T> => {
	const json = await response.json()
	if (response.ok) {
		return json as T
	}
	if (typeof json === 'object' && 'message' in json && typeof json.message === 'string') {
		throw new Error(json.message)
	}
	throw new Error(response.statusText)
}

const updateSearchParams = <T extends object>(searchParams: URLSearchParams, obj?: T) => {
	const isValidValue = (value: unknown) => {
		return value !== undefined && value !== null
	}

	if (!obj) return

	Object.entries(obj).forEach(([key, value]) => {
		if (isValidValue(value)) {
			if (Array.isArray(value)) {
				value.forEach((param) => {
					if (isValidValue(param)) {
						searchParams.append(key, String(param))
					}
				})
			} else if (value instanceof Date) {
				searchParams.set(key, value.toISOString())
			} else if (typeof value === 'object') {
				updateSearchParams(searchParams, value)
			} else {
				searchParams.set(key, String(value))
			}
		}
	})
}

interface HttpRetryOptions {
	maxRetries: number
	baseDelayMs: number
	backoffFactor: number
	jitterFraction: number
	retryableStatuses: Set<number>
}

const DEFAULT_HTTP_RETRY_OPTIONS: HttpRetryOptions = {
	maxRetries: 5,
	baseDelayMs: 1000,
	backoffFactor: 2,
	jitterFraction: 0.25,
	retryableStatuses: new Set([429, 502, 503]),
}

export const withHttpRetry = (
	fetcher: typeof fetch,
	options?: Partial<HttpRetryOptions>
): typeof fetch => {
	const opts = { ...DEFAULT_HTTP_RETRY_OPTIONS, ...options }

	return async (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		let lastResponse: Response | undefined
		for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
			lastResponse = await fetcher(input, init)

			if (!opts.retryableStatuses.has(lastResponse.status)) {
				return lastResponse
			}

			if (attempt === opts.maxRetries) {
				break
			}

			const retryAfter = lastResponse.headers.get('Retry-After')
			let delayMs: number

			if (retryAfter !== null) {
				const parsed = Number(retryAfter)
				if (!Number.isNaN(parsed)) {
					delayMs = parsed * 1000
				} else {
					const date = Date.parse(retryAfter)
					delayMs = Number.isNaN(date) ? opts.baseDelayMs : Math.max(0, date - Date.now())
				}
			} else {
				delayMs = opts.baseDelayMs * Math.pow(opts.backoffFactor, attempt)
			}

			const jitter = delayMs * opts.jitterFraction * Math.random()
			await new Promise((resolve) => setTimeout(resolve, delayMs + jitter))
		}

		return lastResponse!
	}
}

export const appendSearchParams = <T extends object>(pathname: string, obj: T): string => {
	const searchParams = new URLSearchParams()
	updateSearchParams(searchParams, obj)

	if (searchParams.size > 0) {
		return `${pathname}?${searchParams.toString()}`
	}
	return pathname
}
