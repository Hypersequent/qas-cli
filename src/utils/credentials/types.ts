import { z } from 'zod'
import type { AuthType } from '../../api/utils'

export const oauthCredentialsSchema = z.object({
	type: z.literal('oauth'),
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1),
	accessTokenExpiresAt: z.string().datetime(), // ISO 8601
	refreshTokenExpiresAt: z.string().datetime(), // ISO 8601
	tenantUrl: z.string().url(),
})

export type OAuthCredentials = z.infer<typeof oauthCredentialsSchema>

export type ApiKeyCredentialSource = 'env_var' | '.env' | '.qaspherecli'

export type OAuthCredentialSource = 'keyring' | 'credentials.json'

export type CredentialSource = ApiKeyCredentialSource | OAuthCredentialSource

export interface ApiKeyResolved {
	token: string
	tenantUrl: string
	authType: 'apikey'
	source: ApiKeyCredentialSource
}

export interface OAuthResolved {
	credentials: OAuthCredentials
	authType: 'bearer'
	source: OAuthCredentialSource
}

export type ResolvedCredentials = ApiKeyResolved | OAuthResolved

export interface AuthConfig {
	token: string
	baseUrl: string
	authType: AuthType
}
