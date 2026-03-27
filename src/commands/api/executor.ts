import { Readable } from 'node:stream'

import { executePublicApiRequest } from '../../api/publicApi'
import { loadEnvs } from '../../utils/env'
import {
	ApiValidationError,
	collectQueryInput,
	buildPathname,
	loadJsonBodyInput,
	parseIntegerValue,
	serializeQueryObject,
	validateBodyMode,
	validateWithSchema,
} from './helpers'
import { ApiEndpointSpec, ApiOptionSpec } from './types'

export interface ExecuteApiCommandOptions {
	stdin?: Readable
	baseUrl?: string
	apiKey?: string
}

const normalizeOptionValue = (option: ApiOptionSpec, value: unknown) => {
	if (option.type !== 'integer') {
		return value
	}

	if (option.array) {
		const items = Array.isArray(value) ? value : [value]
		return items.map((item, index) => parseIntegerValue(`--${option.name}[${index}]`, item))
	}

	return parseIntegerValue(`--${option.name}`, value)
}

const collectValidatedQuery = (spec: ApiEndpointSpec, args: Record<string, unknown>) => {
	const query = collectQueryInput(args, spec.queryOptions, spec.supportsCustomFieldFilters)
	const normalizedQuery = Object.fromEntries(
		Object.entries(query).map(([key, value]) => {
			const option = spec.queryOptions?.find((item) => item.name === key)
			return [key, option ? normalizeOptionValue(option, value) : value]
		})
	)
	const queryInput = spec.queryAdapter ? spec.queryAdapter(normalizedQuery) : normalizedQuery
	return validateWithSchema<Record<string, unknown>>('Query', spec.querySchema, queryInput)
}

const collectPathParams = (spec: ApiEndpointSpec, args: Record<string, unknown>) => {
	return Object.fromEntries(
		spec.pathParams.map((param) => {
			const rawValue = args[param.name]
			if (param.type === 'integer') {
				return [param.name, parseIntegerValue(`<${param.name}>`, rawValue)]
			}
			if (typeof rawValue !== 'string' || rawValue.length === 0) {
				throw new ApiValidationError(`<${param.name}> is required.`)
			}
			return [param.name, rawValue]
		})
	)
}

const collectBody = async (
	spec: ApiEndpointSpec,
	args: Record<string, unknown>,
	stdin: Readable
) => {
	if (spec.bodyMode === 'none') {
		validateBodyMode(spec.bodyMode, args)
		return undefined
	}

	if (spec.bodyMode === 'file') {
		validateBodyMode('none', args)
		if (typeof args.file !== 'string' || args.file.length === 0) {
			throw new ApiValidationError('--file is required for this command.')
		}
		return { filePath: args.file }
	}

	validateBodyMode('json', args)
	const rawBody = await loadJsonBodyInput(args, stdin)
	const normalizedBody = spec.bodyAdapter ? spec.bodyAdapter(rawBody) : rawBody
	const body = validateWithSchema('Request body', spec.bodySchema, normalizedBody)
	return { jsonBody: body }
}

export const buildApiRequestFromArgs = async (
	spec: ApiEndpointSpec,
	args: Record<string, unknown>,
	stdin: Readable = process.stdin
) => {
	const pathParams = collectPathParams(spec, args)
	const query = collectValidatedQuery(spec, args)
	const body = await collectBody(spec, args, stdin)

	return {
		method: spec.method,
		pathname: buildPathname(spec.pathTemplate, pathParams),
		query: serializeQueryObject(query),
		...body,
	}
}

export const executeApiCommand = async (
	spec: ApiEndpointSpec,
	args: Record<string, unknown>,
	options?: ExecuteApiCommandOptions
) => {
	loadEnvs()
	const request = await buildApiRequestFromArgs(spec, args, options?.stdin)
	const baseUrl = options?.baseUrl ?? process.env.QAS_URL
	const apiKey = options?.apiKey ?? process.env.QAS_TOKEN

	if (!baseUrl || !apiKey) {
		throw new ApiValidationError('QAS_URL and QAS_TOKEN are required.')
	}

	try {
		new URL(baseUrl)
	} catch {
		throw new ApiValidationError(
			'QAS_URL must be a valid absolute URL, for example https://qas.eu1.qasphere.com'
		)
	}

	const response = await executePublicApiRequest(baseUrl, apiKey, request)
	return response
}
