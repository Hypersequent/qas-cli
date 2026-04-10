import { z } from 'zod'
import type { AuthType } from '../../api/utils'

export const oauthCredentialsSchema = z.object({
	type: z.literal('oauth'),
	accessToken: z.string().min(1),
	refreshToken: z.string().min(1),
	accessTokenExpiresAt: z.string().min(1), // ISO 8601
	tenantUrl: z.string().min(1),
})

export type OAuthCredentials = z.infer<typeof oauthCredentialsSchema>

export type CredentialSource = 'env_var' | '.env' | 'keyring' | 'credentials.json' | '.qaspherecli'

export interface ApiKeyResolved {
	token: string
	tenantUrl: string
	authType: 'apikey'
	source: CredentialSource
}

export interface OAuthResolved {
	credentials: OAuthCredentials
	authType: 'bearer'
	source: CredentialSource
}

export type ResolvedCredentials = ApiKeyResolved | OAuthResolved

export interface AuthConfig {
	token: string
	baseUrl: string
	authType: AuthType
}
