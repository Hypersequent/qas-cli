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

export interface CheckTenantResponse {
	redirectUrl: string
}

export interface DeviceCodeResponse {
	userCode: string
	deviceCode: string
	expiresIn: number
	interval: number
}

export interface DeviceTokenPendingResponse {
	status: 'pending'
}

export interface DeviceTokenApprovedResponse {
	status: 'approved'
	data: {
		key: string
		keyName: string
		tenantUrl: string
		email: string
	}
}

type DeviceTokenResponse = DeviceTokenPendingResponse | DeviceTokenApprovedResponse

const createFetcher = (baseUrl: string) =>
	withFetchMiddlewares(
		fetch,
		withBaseUrl(baseUrl),
		withUserAgent(CLI_VERSION),
		withJson,
		withHttpRetry
	)

export async function checkTenant(teamName: string): Promise<{ tenantUrl: string }> {
	const fetcher = createFetcher(LOGIN_SERVICE_URL)
	const response = await fetcher(`/api/check-tenant?name=${encodeURIComponent(teamName)}`, {
		method: 'GET',
	})
	const data = await jsonResponse<CheckTenantResponse>(response)

	// The check-tenant endpoint returns a redirect URL (e.g. http://tenant.localhost:5173/login).
	// Extract just the origin for use as the API base URL.
	const origin = new URL(data.redirectUrl).origin
	return { tenantUrl: origin }
}

export async function requestDeviceCode(tenantUrl: string): Promise<DeviceCodeResponse> {
	const fetcher = createFetcher(tenantUrl)
	const response = await fetcher('/api/auth/device/code', {
		method: 'POST',
	})
	return jsonResponse<DeviceCodeResponse>(response)
}

export async function pollDeviceToken(
	tenantUrl: string,
	deviceCode: string
): Promise<DeviceTokenResponse> {
	const fetcher = createFetcher(tenantUrl)
	const response = await fetcher('/api/auth/device/token', {
		method: 'POST',
		body: JSON.stringify({ deviceCode }),
	})
	return jsonResponse<DeviceTokenResponse>(response)
}
