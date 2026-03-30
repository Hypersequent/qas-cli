import { ZodType } from 'zod'
import { type Api } from '../../api/index'

export type ApiValueType = 'string' | 'number' | 'boolean'

export interface ApiPathParamSpec {
	name: string
	describe: string
	type: ApiValueType
	schema?: ZodType
}

interface ApiOptionBase {
	name: string
	type: ApiValueType
	describe: string
	schema?: ZodType
	choices?: readonly string[]
	yargsOption?: Record<string, unknown>
}

export interface ApiFieldSpec extends ApiOptionBase {
	/** If true, the string value is parsed as JSON before validation */
	jsonParse?: boolean
}

export type ApiQueryOptionSpec = ApiOptionBase

export interface ExecuteParams {
	pathParams: Record<string, string | number>
	query: Record<string, unknown>
	body: unknown
}

export type ExecuteFn = (api: Api, params: ExecuteParams) => Promise<void>

interface ApiEndpointBase {
	id: string
	commandPath: string[]
	describe: string
	epilog?: string
	examples?: ReadonlyArray<{ readonly usage: string; readonly description: string }>
	pathParams: ApiPathParamSpec[]
	queryOptions?: ApiQueryOptionSpec[]
	transformQuery?: (query: Record<string, unknown>) => Record<string, unknown>
	check?: (argv: Record<string, unknown>) => true | string
	execute: ExecuteFn
}

interface ApiEndpointNone extends ApiEndpointBase {
	bodyMode: 'none'
}

interface ApiEndpointJson extends ApiEndpointBase {
	bodyMode: 'json'
	fieldOptions?: ApiFieldSpec[]
	/** Transform field values into body properties. Defaults to kebabToCamelCase. */
	transformFields?: (fields: Record<string, unknown>) => Record<string, unknown>
}

interface ApiEndpointFile extends ApiEndpointBase {
	bodyMode: 'file'
	/** Maximum file size in bytes */
	maxSize?: number
}

export type ApiEndpointSpec = ApiEndpointNone | ApiEndpointJson | ApiEndpointFile
