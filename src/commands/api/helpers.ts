import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { Readable } from 'node:stream'
import { ZodError, ZodTypeAny } from 'zod'

import { ApiEndpointSpec, ApiOptionSpec } from './types'

export interface JsonBodyInputArgs {
	body?: string
	bodyFile?: string
	bodyStdin?: boolean
}

export class ApiValidationError extends Error {}

const BODY_SOURCE_FLAGS = ['body', 'bodyFile', 'bodyStdin'] as const

export const validateBodyMode = (
	bodyMode: ApiEndpointSpec['bodyMode'],
	args: JsonBodyInputArgs
) => {
	const usedSources = BODY_SOURCE_FLAGS.filter((key) => {
		if (key === 'bodyStdin') {
			return args[key] === true
		}
		return typeof args[key] === 'string'
	})

	if (bodyMode === 'none') {
		if (usedSources.length > 0) {
			throw new ApiValidationError(
				'JSON body flags are not supported for this command: use only the documented positional args and query flags.'
			)
		}
		return
	}

	if (bodyMode === 'json') {
		if (usedSources.length === 0) {
			throw new ApiValidationError(
				'Exactly one of --body, --body-file, or --body-stdin is required.'
			)
		}
		if (usedSources.length > 1) {
			throw new ApiValidationError(
				'Only one of --body, --body-file, or --body-stdin may be provided.'
			)
		}
	}
}

const formatJsonParseError = (source: string, error: unknown) => {
	const message = error instanceof Error ? error.message : String(error)
	return `Invalid JSON from ${source}: ${message}`
}

const readStreamText = async (stream: Readable) => {
	const chunks: Buffer[] = []
	for await (const chunk of stream) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)))
	}
	return Buffer.concat(chunks).toString('utf8')
}

export const loadJsonBodyInput = async (
	args: JsonBodyInputArgs,
	stdin: Readable = process.stdin
): Promise<unknown> => {
	if (typeof args.body === 'string') {
		try {
			return JSON.parse(args.body)
		} catch (error) {
			throw new ApiValidationError(formatJsonParseError('--body', error))
		}
	}

	if (typeof args.bodyFile === 'string') {
		const filePath = args.bodyFile
		try {
			const raw = await readFile(filePath, 'utf8')
			return JSON.parse(raw)
		} catch (error) {
			throw new ApiValidationError(formatJsonParseError(`--body-file ${filePath}`, error))
		}
	}

	if (args.bodyStdin) {
		try {
			const raw = await readStreamText(stdin)
			return JSON.parse(raw)
		} catch (error) {
			throw new ApiValidationError(formatJsonParseError('--body-stdin', error))
		}
	}

	throw new ApiValidationError('Missing JSON body source.')
}

const formatZodIssuePath = (path: Array<string | number>) => {
	if (path.length === 0) {
		return '$'
	}
	return path
		.map((part) => (typeof part === 'number' ? `[${part}]` : part))
		.join('.')
		.replace('.[', '[')
}

export const formatZodError = (label: string, error: ZodError) => {
	const lines = error.issues.map((issue) => `${formatZodIssuePath(issue.path)}: ${issue.message}`)
	return `${label} validation failed:\n${lines.join('\n')}`
}

export const validateWithSchema = <T>(
	label: string,
	schema: ZodTypeAny | undefined,
	value: unknown
): T => {
	if (!schema) {
		return value as T
	}
	const result = schema.safeParse(value)
	if (!result.success) {
		throw new ApiValidationError(formatZodError(label, result.error))
	}
	return result.data as T
}

export const applyNullDefaults = (
	value: Record<string, unknown>,
	keys: string[] | undefined
): Record<string, unknown> => {
	if (!keys || keys.length === 0) {
		return value
	}
	const next = { ...value }
	for (const key of keys) {
		if (!(key in next)) {
			next[key] = null
		}
	}
	return next
}

export const parseCustomFieldFilters = (values: unknown): Record<string, string[]> => {
	const filters = Array.isArray(values) ? values : values === undefined ? [] : [values]
	const parsed: Record<string, string[]> = {}

	for (const rawValue of filters) {
		if (typeof rawValue !== 'string') {
			throw new ApiValidationError('Each --cf value must be in key=value format.')
		}
		const eqIndex = rawValue.indexOf('=')
		if (eqIndex <= 0 || eqIndex === rawValue.length - 1) {
			throw new ApiValidationError('--cf must be exactly key=value with non-empty key and value.')
		}
		const key = rawValue.slice(0, eqIndex)
		const value = rawValue.slice(eqIndex + 1)
		if (!parsed[key]) {
			parsed[key] = []
		}
		parsed[key].push(value)
	}

	return parsed
}

export const collectQueryInput = (
	args: Record<string, unknown>,
	queryOptions: ApiOptionSpec[] | undefined,
	supportsCustomFieldFilters: boolean | undefined
) => {
	const query: Record<string, unknown> = {}

	for (const option of queryOptions ?? []) {
		const value = args[option.name]
		if (value !== undefined) {
			query[option.name] = value
		}
	}

	if (supportsCustomFieldFilters && args.cf !== undefined) {
		query.customFields = parseCustomFieldFilters(args.cf)
	}

	return query
}

export const serializeQueryObject = (query: Record<string, unknown>) => {
	const searchParams = new URLSearchParams()

	for (const [key, rawValue] of Object.entries(query)) {
		if (rawValue === undefined || rawValue === null) {
			continue
		}

		if (key === 'customFields' && typeof rawValue === 'object' && rawValue) {
			for (const [fieldName, values] of Object.entries(rawValue as Record<string, unknown>)) {
				const items = Array.isArray(values) ? values : [values]
				for (const item of items) {
					if (item !== undefined && item !== null) {
						searchParams.append(`cf_${fieldName}`, String(item))
					}
				}
			}
			continue
		}

		if (Array.isArray(rawValue)) {
			for (const item of rawValue) {
				if (item !== undefined && item !== null) {
					searchParams.append(key, String(item))
				}
			}
			continue
		}

		if (rawValue instanceof Date) {
			searchParams.set(key, rawValue.toISOString())
			continue
		}

		searchParams.set(key, String(rawValue))
	}

	return searchParams
}

export const buildPathname = (template: string, pathParams: Record<string, string | number>) =>
	template.replace(/\{([^}]+)\}/g, (_, key: string) => encodeURIComponent(String(pathParams[key])))

export const parseIntegerValue = (label: string, value: unknown) => {
	if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
		return value
	}
	if (typeof value === 'string' && /^-?\d+$/.test(value)) {
		return Number(value)
	}
	throw new ApiValidationError(`${label} must be a finite integer.`)
}

export const buildUploadFile = async (filePath: string) => {
	const fileBuffer = await readFile(filePath)
	return {
		formField: 'file',
		fileName: basename(filePath),
		blob: new Blob([fileBuffer]),
		stream: createReadStream(filePath),
	}
}
