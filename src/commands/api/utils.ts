import { existsSync, readFileSync } from 'node:fs'
import chalk from 'chalk'
import type { ZodType } from 'zod'
import {
	RequestValidationError,
	sortFieldParam,
	sortOrderParam,
	pageParam,
	limitParam,
	type SortOrder,
} from '../../api/schemas'
import type { ApiFieldSpec, ApiPathParamSpec } from './types'

export { sortFieldParam, sortOrderParam, pageParam, limitParam, type SortOrder }

export function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2))
}

export const apiDocsEpilog = (resource: string, hash?: string) =>
	`API documentation: https://docs.qasphere.com/api/${resource}${hash ? `#${hash}` : ''}`

export interface ArgumentValidationIssue {
	argument: string
	message: string
}

export class ArgumentValidationError extends Error {
	constructor(public readonly issues: ArgumentValidationIssue[]) {
		super('Validation failed')
		this.name = 'ArgumentValidationError'
	}
}

export function formatApiError(e: unknown, verbose = false): void {
	const isVerbose = verbose

	if (e instanceof ArgumentValidationError) {
		console.error(`${chalk.red('Error:')} Invalid arguments:`)
		for (const issue of e.issues) {
			console.error(`  ${issue.argument}: ${issue.message}`)
		}
		return
	}

	if (e instanceof RequestValidationError) {
		console.error(`${chalk.red('Error:')} Invalid request parameters:`)
		for (const issue of e.zodError.issues) {
			const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
			console.error(`  - ${path}: ${issue.message}`)
		}
		if (isVerbose) {
			console.error(chalk.dim('\nRaw value:'), JSON.stringify(e.rawValue, null, 2))
		}
		return
	}

	if (e instanceof TypeError && e.message === 'fetch failed') {
		const cause = (e as TypeError & { cause?: { code?: string; message?: string } }).cause
		const hint =
			cause?.code === 'ECONNREFUSED'
				? 'Connection refused. Is QAS_URL correct and the server running?'
				: cause?.code === 'ENOTFOUND'
					? 'Host not found. Check QAS_URL for typos.'
					: 'Network error. Check your connection and QAS_URL.'
		console.error(`${chalk.red('Error:')} ${hint}`)
		if (isVerbose && cause) {
			console.error(chalk.dim(`  ${cause.message ?? String(cause)}`))
		}
		return
	}

	if (e instanceof Error) {
		console.error(`${chalk.red('Error:')} ${e.message}`)
		if (isVerbose && e.stack) {
			console.error(chalk.dim(e.stack))
		}
	} else {
		console.error(`${chalk.red('Error:')} ${String(e)}`)
	}
}

/**
 * Converts object keys from kebab-case to camelCase.
 * Example: { 'folder-id': 1, 'is-draft': false } → { folderId: 1, isDraft: false }
 */
export function kebabToCamel(key: string): string {
	return key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
}

export function kebabToCamelCaseKeys(obj: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [kebabToCamel(k), v]))
}

/**
 * Parses a JSON string field value.
 * Returns the parsed value, or throws with a descriptive error.
 */
function parseJsonFieldValue(value: unknown, fieldName: string): unknown {
	if (typeof value !== 'string') return value

	try {
		return JSON.parse(value)
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		throw new Error(`Failed to parse --${fieldName} as JSON: ${msg}`)
	}
}

/**
 * Validates individual field values against their Zod schemas.
 * For fields with jsonParse: true, parses JSON strings before validation.
 * Collects all errors and returns them as an array of issues.
 * Updates the values record in place with parsed JSON values.
 * Only validates fields that are present (not undefined) in the provided values.
 */
export function validateFieldValues(
	values: Record<string, unknown>,
	fieldOptions: ApiFieldSpec[]
): ArgumentValidationIssue[] {
	const issues: ArgumentValidationIssue[] = []

	for (const field of fieldOptions) {
		if (!(field.name in values)) continue
		if (!field.schema) continue

		let value = values[field.name]

		// Parse JSON string fields before validation
		if (field.jsonParse && typeof value === 'string') {
			try {
				value = parseJsonFieldValue(value, field.name)
				values[field.name] = value
			} catch (e) {
				issues.push({
					argument: `--${field.name}`,
					message: e instanceof Error ? e.message : String(e),
				})
				continue
			}
		}

		const result = field.schema.safeParse(value)
		if (result.success) {
			// Store validated (and possibly transformed) value back
			values[field.name] = result.data
		} else {
			for (const issue of result.error.issues) {
				const path = issue.path.length > 0 ? `.${issue.path.join('.')}` : ''
				issues.push({
					argument: `--${field.name}${path}`,
					message: issue.message,
				})
			}
		}
	}

	return issues
}

/**
 * Validates named option values against their optional Zod schemas.
 * Works for both path params and query options.
 */
export function validateOptionValues(
	values: Record<string, unknown>,
	options: { name: string; schema?: ZodType }[]
): ArgumentValidationIssue[] {
	const issues: ArgumentValidationIssue[] = []

	for (const opt of options) {
		if (!opt.schema) continue
		if (!(opt.name in values)) continue

		const value = values[opt.name]
		const result = opt.schema.safeParse(value)
		if (!result.success) {
			for (const issue of result.error.issues) {
				issues.push({
					argument: `--${opt.name}`,
					message: issue.message,
				})
			}
		}
	}

	return issues
}

/**
 * Parses JSON body input from --body (inline JSON) or --body-file (file path).
 * Returns the parsed object, or undefined if neither is provided.
 */
export function parseBodyInput(args: Record<string, unknown>): unknown {
	const bodyStr = args['body'] as string | undefined
	const bodyFile = args['body-file'] as string | undefined

	if (bodyStr !== undefined) {
		try {
			return JSON.parse(bodyStr)
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e)
			throw new Error(
				`Failed to parse --body as JSON: ${errorMessage}\n` +
					`  Provide valid inline JSON or use --body-file to read from a file.\n` +
					`  Inline example: --body '{"title": "Test"}'\n` +
					`  File example:   --body-file body.json`
			)
		}
	}

	if (bodyFile) {
		if (!existsSync(bodyFile)) {
			throw new Error(`File not found for --body-file: ${bodyFile}`)
		}
		const content = readFileSync(bodyFile, 'utf-8')
		try {
			return JSON.parse(content)
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e)
			throw new Error(`Failed to parse JSON from file ${bodyFile} for --body-file: ${errorMessage}`)
		}
	}

	return undefined
}

/**
 * Merges a base body object (from --body/--body-file) with transformed field values.
 * Field values override body values. Undefined values are stripped from fields.
 */
export function mergeBodyWithFields(
	bodyObj: unknown,
	transformedFields: Record<string, unknown>
): Record<string, unknown> {
	const base = (bodyObj ?? {}) as Record<string, unknown>
	const fields = Object.fromEntries(
		Object.entries(transformedFields).filter(([, v]) => v !== undefined)
	)
	return { ...base, ...fields }
}

/**
 * Catches RequestValidationError from the API layer and reformats it.
 * Maps root field names to CLI argument names when an argumentMap is provided,
 * otherwise prefixes with --body.
 */
export function handleApiValidationError(e: unknown, argumentMap?: Record<string, string>): never {
	if (e instanceof RequestValidationError) {
		const issues = e.zodError.issues.map((issue) => {
			const fieldPath = issue.path.join('.')
			const rootField = String(issue.path[0])
			const argument = argumentMap?.[rootField] ?? '--body'
			const message =
				issue.path.length > 1
					? `${fieldPath}: ${issue.message}`
					: issue.path.length === 1 && !argumentMap?.[rootField]
						? `body.${fieldPath}: ${issue.message}`
						: issue.message
			return { argument, message }
		})
		throw new ArgumentValidationError(issues)
	}
	throw e
}

/**
 * Collects provided field values from args based on fieldOptions.
 * Only includes fields that were actually provided (not undefined).
 */
export function collectFieldValues(
	args: Record<string, unknown>,
	fieldOptions: ApiFieldSpec[]
): Record<string, unknown> {
	const values: Record<string, unknown> = {}
	for (const field of fieldOptions) {
		if (args[field.name] !== undefined) {
			values[field.name] = args[field.name]
		}
	}
	return values
}

/**
 * Collects path param values from args.
 */
export function collectPathParamValues(
	args: Record<string, unknown>,
	pathParams: ApiPathParamSpec[]
): Record<string, string | number> {
	const values: Record<string, string | number> = {}
	for (const param of pathParams) {
		values[param.name] = args[param.name] as string | number
	}
	return values
}

/**
 * Collects query option values from args based on queryOptions.
 * Only includes values that were actually provided.
 */
export function collectQueryValues(
	args: Record<string, unknown>,
	queryOptions: { name: string }[]
): Record<string, unknown> {
	const values: Record<string, unknown> = {}
	for (const opt of queryOptions) {
		if (args[opt.name] !== undefined) {
			values[opt.name] = args[opt.name]
		}
	}
	return values
}
