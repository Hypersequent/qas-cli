import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'

import { CLI_VERSION } from '../utils/version'
import { withBaseUrl, withHeaders, withHttpRetry } from './utils'

export interface PublicApiRequest {
	method: 'GET' | 'POST' | 'PATCH'
	pathname: string
	query?: URLSearchParams
	jsonBody?: unknown
	filePath?: string
}

const createPublicApiFetcher = (baseUrl: string, apiKey: string) =>
	withHttpRetry(
		withHeaders(withBaseUrl(fetch, baseUrl), {
			Authorization: `ApiKey ${apiKey}`,
			Accept: 'application/json',
			'User-Agent': `qas-cli/${CLI_VERSION}`,
		})
	)

const buildErrorFromResponse = async (response: Response) => {
	const contentType = response.headers.get('content-type') ?? ''
	if (contentType.includes('application/json')) {
		try {
			const body = (await response.json()) as Record<string, unknown>
			const message = typeof body.message === 'string' ? body.message : response.statusText
			throw new Error(message)
		} catch (error) {
			if (error instanceof Error && error.message !== 'Unexpected end of JSON input') {
				throw error
			}
		}
	}

	const text = await response.text()
	throw new Error(text || response.statusText || `Request failed with status ${response.status}`)
}

const parseJsonResponse = async (response: Response) => {
	if (response.status === 204) {
		return null
	}

	const contentType = response.headers.get('content-type') ?? ''
	if (!contentType.includes('application/json')) {
		const text = await response.text()
		return text ? JSON.parse(text) : null
	}

	const text = await response.text()
	return text ? JSON.parse(text) : null
}

export const executePublicApiRequest = async (
	baseUrl: string,
	apiKey: string,
	request: PublicApiRequest
) => {
	const fetcher = createPublicApiFetcher(baseUrl, apiKey)
	const query = request.query?.size ? `?${request.query.toString()}` : ''
	const url = `${request.pathname}${query}`

	if (request.filePath) {
		const fileBuffer = await readFile(request.filePath)
		const formData = new FormData()
		formData.append('file', new Blob([fileBuffer]), basename(request.filePath))
		const response = await fetcher(url, {
			method: request.method,
			body: formData,
		})
		if (!response.ok) {
			return buildErrorFromResponse(response)
		}
		return parseJsonResponse(response)
	}

	const response = await fetcher(url, {
		method: request.method,
		headers:
			request.jsonBody === undefined
				? undefined
				: {
						'Content-Type': 'application/json',
					},
		body: request.jsonBody === undefined ? undefined : JSON.stringify(request.jsonBody),
	})

	if (!response.ok) {
		return buildErrorFromResponse(response)
	}

	return parseJsonResponse(response)
}
