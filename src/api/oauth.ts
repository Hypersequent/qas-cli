import { z } from 'zod'
import {
	withFetchMiddlewares,
	withBaseUrl,
	withJson,
	withUserAgent,
	withHttpRetry,
	jsonResponse,
} from './utils'
import { CLI_VERSION } from '../utils/version'
import { LOGIN_SERVICE_URL } from '../utils/config'

const OAUTH_CLIENT_ID = 'qas-cli'
const DEVICE_CODE_GRANT_TYPE = 'urn:ietf:params:oauth:grant-type:device_code'
const REFRESH_TOKEN_GRANT_TYPE = 'refresh_token'

// --- Schemas & types ---

export const CheckTenantResponseSchema = z.object({
	redirectUrl: z.string().url(),
	suspended: z.boolean(),
})
export type CheckTenantResponse = z.infer<typeof CheckTenantResponseSchema>

export const OAuthDeviceCodeResponseSchema = z.object({
	device_code: z.string(),
	user_code: z.string(),
	verification_uri: z.string(),
	verification_uri_complete: z.string(),
	expires_in: z.number(),
	interval: z.number(),
})
export type OAuthDeviceCodeResponse = z.infer<typeof OAuthDeviceCodeResponseSchema>

export const OAuthTokenResponseSchema = z.object({
	access_token: z.string(),
	token_type: z.string(),
	expires_in: z.number(),
	refresh_token: z.string(),
	refresh_token_expires_in: z.number(),
})
export type OAuthTokenResponse = z.infer<typeof OAuthTokenResponseSchema>

export const OAuthErrorResponseSchema = z.object({
	error: z.string(),
	error_description: z.string().optional(),
})
export type OAuthErrorResponse = z.infer<typeof OAuthErrorResponseSchema>

export type OAuthTokenResult =
	| { ok: true; data: OAuthTokenResponse }
	| { ok: false; error: OAuthErrorResponse }

export class OAuthProtocolError extends Error {
	readonly code: string
	readonly description?: string

	constructor(error: OAuthErrorResponse) {
		super(error.error_description || error.error)
		this.name = 'OAuthProtocolError'
		this.code = error.error
		this.description = error.error_description
	}
}

function parseOAuthResponse<T>(schema: z.ZodType<T>, payload: unknown, context: string): T {
	const result = schema.safeParse(payload)
	if (!result.success) {
		const issues = result.error.issues
			.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`)
			.join('; ')
		throw new Error(`Invalid ${context} response from OAuth server: ${issues}`)
	}
	return result.data
}

// --- Helpers ---

const createFetcher = (baseUrl: string) =>
	withFetchMiddlewares(
		fetch,
		withBaseUrl(baseUrl),
		withUserAgent(CLI_VERSION),
		withJson,
		withHttpRetry
	)

async function oauthErrorResponse(response: Response): Promise<OAuthErrorResponse> {
	try {
		const json = await response.json()
		const parsed = OAuthErrorResponseSchema.safeParse(json)
		if (parsed.success) {
			return {
				error: parsed.data.error || 'unknown_error',
				error_description: parsed.data.error_description || response.statusText,
			}
		}
		return { error: 'unknown_error', error_description: response.statusText }
	} catch {
		return { error: 'unknown_error', error_description: response.statusText }
	}
}

// --- API functions ---

export async function checkTenant(
	teamName: string
): Promise<{ tenantUrl: string; suspended: boolean }> {
	const fetcher = createFetcher(LOGIN_SERVICE_URL)
	const response = await fetcher(`/api/check-tenant?name=${encodeURIComponent(teamName)}`, {
		method: 'GET',
	})
	const raw = await jsonResponse<unknown>(response)
	const data = parseOAuthResponse(CheckTenantResponseSchema, raw, 'check-tenant')

	// The check-tenant endpoint returns a redirect URL (e.g. http://tenant.localhost:5173/login).
	// Extract just the origin for use as the API base URL.
	const origin = new URL(data.redirectUrl).origin
	return { tenantUrl: origin, suspended: data.suspended }
}

export async function requestDeviceCode(tenantUrl: string): Promise<OAuthDeviceCodeResponse> {
	const fetcher = createFetcher(tenantUrl)
	const response = await fetcher('/api/oauth/device/code', {
		method: 'POST',
		body: JSON.stringify({ client_id: OAUTH_CLIENT_ID }),
	})

	if (!response.ok) {
		const err = await oauthErrorResponse(response)
		throw new Error(err.error_description || err.error)
	}

	return parseOAuthResponse(OAuthDeviceCodeResponseSchema, await response.json(), 'device-code')
}

export async function pollDeviceToken(
	tenantUrl: string,
	deviceCode: string
): Promise<OAuthTokenResult> {
	const fetcher = createFetcher(tenantUrl)
	const response = await fetcher('/api/oauth/token', {
		method: 'POST',
		body: JSON.stringify({
			grant_type: DEVICE_CODE_GRANT_TYPE,
			client_id: OAUTH_CLIENT_ID,
			device_code: deviceCode,
		}),
	})

	if (response.ok) {
		return {
			ok: true,
			data: parseOAuthResponse(OAuthTokenResponseSchema, await response.json(), 'token'),
		}
	}

	const error = await oauthErrorResponse(response)
	return { ok: false, error }
}

export async function refreshAccessToken(
	tenantUrl: string,
	refreshToken: string
): Promise<OAuthTokenResponse> {
	const fetcher = createFetcher(tenantUrl)
	const response = await fetcher('/api/oauth/token', {
		method: 'POST',
		body: JSON.stringify({
			grant_type: REFRESH_TOKEN_GRANT_TYPE,
			client_id: OAUTH_CLIENT_ID,
			refresh_token: refreshToken,
		}),
	})

	if (!response.ok) {
		const err = await oauthErrorResponse(response)
		// 4xx with a recognized OAuth error code is a protocol-level rejection
		// (refresh token revoked, invalid client, etc.). Anything else (5xx,
		// unrecognized 4xx) is treated as transport so callers can preserve credentials.
		if (response.status >= 400 && response.status < 500 && err.error !== 'unknown_error') {
			throw new OAuthProtocolError(err)
		}
		throw new Error(err.error_description || err.error || response.statusText)
	}

	return parseOAuthResponse(OAuthTokenResponseSchema, await response.json(), 'refresh-token')
}
