import { ZodTypeAny } from 'zod'

export type ApiCommandPath = [string, ...string[]]

export type ApiHttpMethod = 'GET' | 'POST' | 'PATCH'

export type ApiBodyMode = 'none' | 'json' | 'file'

export type ApiValueType = 'string' | 'integer' | 'boolean'

export interface ApiPathParamSpec {
	name: string
	describe: string
	type: Extract<ApiValueType, 'string' | 'integer'>
}

export interface ApiOptionSpec {
	name: string
	describe: string
	type: ApiValueType
	array?: boolean
	choices?: readonly string[]
}

export interface ApiRequestEnvelope {
	query?: Record<string, unknown>
	body?: unknown
}

export interface ApiEndpointSpec {
	id: string
	commandPath: ApiCommandPath
	describe: string
	method: ApiHttpMethod
	pathTemplate: string
	pathParams: ApiPathParamSpec[]
	queryOptions?: ApiOptionSpec[]
	supportsCustomFieldFilters?: boolean
	bodyMode: ApiBodyMode
	querySchema?: ZodTypeAny
	bodySchema?: ZodTypeAny
	responseSchema?: ZodTypeAny
	queryNullDefaults?: string[]
	bodyNullDefaults?: string[]
	queryAdapter?: (value: Record<string, unknown>) => Record<string, unknown>
	bodyAdapter?: (value: unknown) => unknown
	requestSchemaLinks?: {
		query?: string
		body?: string
		response?: string
	}
	examples?: string[]
}
