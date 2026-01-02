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

export const appendSearchParams = <T extends object>(pathname: string, obj: T): string => {
	const searchParams = new URLSearchParams()
	updateSearchParams(searchParams, obj)

	if (searchParams.size > 0) {
		return `${pathname}?${searchParams.toString()}`
	}
	return pathname
}
