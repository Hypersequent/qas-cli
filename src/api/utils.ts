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
