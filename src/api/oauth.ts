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

// --- Types ---

export interface CheckTenantResponse {
	redirectUrl: string
	suspended: boolean
}

export interface OAuthDeviceCodeResponse {
	device_code: string
	user_code: string
	verification_uri: string
	verification_uri_complete: string
	expires_in: number
	interval: number
}

export interface OAuthTokenResponse {
	access_token: string
	token_type: string
	expires_in: number
	refresh_token: string
	refresh_token_expires_in: number
}

export interface OAuthErrorResponse {
	error: string
	error_description?: string
}

export type OAuthTokenResult =
	| { ok: true; data: OAuthTokenResponse }
	| { ok: false; error: OAuthErrorResponse }

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
		const json = (await response.json()) as OAuthErrorResponse
		return {
			error: json.error || 'unknown_error',
			error_description: json.error_description || response.statusText,
		}
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
	const data = await jsonResponse<CheckTenantResponse>(response)

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

	return (await response.json()) as OAuthDeviceCodeResponse
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
		return { ok: true, data: (await response.json()) as OAuthTokenResponse }
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
			refresh_token: refreshToken,
		}),
	})

	if (!response.ok) {
		const err = await oauthErrorResponse(response)
		throw new Error(err.error_description || err.error)
	}

	return (await response.json()) as OAuthTokenResponse
}
