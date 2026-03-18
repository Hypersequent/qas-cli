export const withBaseUrl = (fetcher: typeof fetch, baseUrl: string): typeof fetch => {
	return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		if (typeof input === 'string') {
			return fetcher(baseUrl + input, init)
		}
		return fetcher(input, init)
	}
}

export const withJson = (fetcher: typeof fetch): typeof fetch => {
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

export const withDevAuth = (fetcher: typeof fetch): typeof fetch => {
	const devAuth = process.env.QAS_DEV_AUTH
	if (!devAuth) return fetcher

	return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		const prev = (init?.headers as Record<string, string> | undefined) ?? {}
		const existing = prev['Cookie']
		const cookie = existing ? `${existing}; _devauth=${devAuth}` : `_devauth=${devAuth}`
		return fetcher(input, {
			...init,
			headers: {
				...prev,
				Cookie: cookie,
			},
		})
	}
}

export const withApiKey = (fetcher: typeof fetch, apiKey: string): typeof fetch => {
	return (input: URL | RequestInfo, init?: RequestInit | undefined) => {
		return fetcher(input, {
			...init,
			headers: {
				Authorization: `ApiKey ${apiKey}`,
				...init?.headers,
			},
		})
	}
}

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
