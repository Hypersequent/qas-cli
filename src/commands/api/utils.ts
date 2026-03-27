import { existsSync, readFileSync } from 'node:fs'
import chalk from 'chalk'
import { z, ZodError, ZodType } from 'zod'
import { loadEnvs } from '../../utils/env'
import { createApi, Api } from '../../api/index'
import {
	RequestValidationError,
	sortFieldParam,
	sortOrderParam,
	pageParam,
	limitParam,
	type SortOrder,
} from '../../api/schemas'

export { sortFieldParam, sortOrderParam, pageParam, limitParam, type SortOrder }

const RESOURCE_ID_REGEX = /^[a-zA-Z0-9_-]+$/
const RESOURCE_ID_MESSAGE = 'must contain only alphanumeric characters, dashes, and underscores'

export const resourceIdSchema = z.string().regex(RESOURCE_ID_REGEX, RESOURCE_ID_MESSAGE)

export function validateResourceId(...params: [string, string][]): void {
	const errors = params
		.filter(([value]) => !RESOURCE_ID_REGEX.test(value))
		.map(([, name]) => `${name} ${RESOURCE_ID_MESSAGE}`)
	if (errors.length > 0) {
		throw new Error(errors.join('\n'))
	}
}

const PROJECT_CODE_REGEX = /^[a-zA-Z0-9]+$/

export function validateProjectCode(...params: [string, string][]): void {
	const errors = params
		.filter(([value]) => !PROJECT_CODE_REGEX.test(value))
		.map(([, name]) => `${name} must contain only latin letters and digits`)
	if (errors.length > 0) {
		throw new Error(errors.join('\n'))
	}
}

export function validateIntId(...params: [number, string][]): void {
	const errors = params
		.filter(([value]) => !Number.isInteger(value) || value <= 0)
		.map(([, name]) => `${name} must be a positive integer`)
	if (errors.length > 0) {
		throw new Error(errors.join('\n'))
	}
}

export function printJson(data: unknown): void {
	console.log(JSON.stringify(data, null, 2))
}

export const apiDocsEpilog = (resource: string, hash?: string) =>
	`API documentation: https://docs.qasphere.com/api/${resource}${hash ? `#${hash}` : ''}`

/**
 * Parses a CLI argument that accepts either inline JSON or a @filename reference.
 * Provides detailed error messages for AI agents and human users.
 */
function parseJsonArg(value: string, optionName: string): unknown {
	if (value.startsWith('@')) {
		const filePath = value.slice(1)
		if (!filePath) {
			throw new Error(`${optionName} "@" must be followed by a file path (e.g., @plans.json)`)
		}
		if (!existsSync(filePath)) {
			throw new Error(`File not found for ${optionName}: ${filePath}`)
		}
		const content = readFileSync(filePath, 'utf-8')
		try {
			return JSON.parse(content)
		} catch (e) {
			const errorMessage = e instanceof Error ? e.message : String(e)
			throw new Error(
				`Failed to parse JSON from file ${filePath} for ${optionName}: ${errorMessage}`
			)
		}
	}

	return mustParseJson(value, optionName)
}

function mustParseJson(value: string, optionName: string) {
	try {
		return JSON.parse(value)
	} catch (e) {
		throw new Error(
			`Failed to parse ${optionName} as JSON: ${e instanceof Error ? e.message : String(e)}\n` +
				`  Provide valid inline JSON or use @filename to read from a file.\n` +
				`  Inline example: ${optionName} '[{"tcaseIds": ["abc"]}]'\n` +
				`  File example:   ${optionName} @plans.json`
		)
	}
}

/**
 * Wraps an API command handler with common setup:
 * 1. Catches and formats errors with actionable messages
 * 2. Provides a `connectApi()` function that lazily loads env vars and creates the API client
 *    (call this after validation so arg errors are reported before missing-env-var errors)
 */
export function apiHandler<T>(
	fn: (args: T, connectApi: () => Api) => Promise<void>
): (args: T) => Promise<void> {
	return async (args) => {
		try {
			const connectApi = () => {
				loadEnvs()
				return createApi(process.env.QAS_URL!, process.env.QAS_TOKEN!)
			}
			await fn(args, connectApi)
		} catch (e) {
			formatApiError(e)
			process.exit(1)
		}
	}
}

/**
 * Parses a JSON CLI argument and validates it against a Zod schema.
 * Produces detailed error messages showing exactly which fields failed
 * and what was expected, suitable for AI agents and human users.
 */
export function parseAndValidateJsonArg<T>(
	value: string,
	optionName: string,
	schema: ZodType<T>
): T {
	const parsed = parseJsonArg(value, optionName)
	return validateWithSchema(parsed, optionName, schema)
}

/**
 * Validates an unknown value against a Zod schema, formatting errors
 * with the CLI option name and path to each invalid field.
 */
export function parseOptionalJsonField<T>(
	value: string | undefined,
	optionName: string,
	schema: ZodType<T>
): T | undefined {
	return value ? parseAndValidateJsonArg(value, optionName, schema) : undefined
}

export function validateWithSchema<T>(value: unknown, optionName: string, schema: ZodType<T>): T {
	try {
		return schema.parse(value)
	} catch (e) {
		if (e instanceof ZodError) {
			throw new Error(formatZodError(e, optionName))
		}
		throw e
	}
}

function formatZodError(error: ZodError, optionName: string): string {
	const lines = [`Validation failed for ${optionName}:`]
	for (const issue of error.issues) {
		const path = issue.path.length > 0 ? issue.path.join('.') : '(root)'
		lines.push(`  - ${path}: ${issue.message}`)
	}
	return lines.join('\n')
}

interface ArgumentValidationIssue {
	argument: string
	message: string
}

export class ArgumentValidationError extends Error {
	constructor(public readonly issues: ArgumentValidationIssue[]) {
		super('Validation failed')
		this.name = 'ArgumentValidationError'
	}
}

/**
 * Builds an argument map from CLI argument names.
 * Single-word args map directly (e.g., "search" → { search: "--search" }).
 * Hyphenated args map to camelCase (e.g., "sort-field" → { sortField: "--sort-field" }).
 */
export function buildArgumentMap(args: string[]): Record<string, string> {
	const map: Record<string, string> = {}
	for (const arg of args) {
		const camelCase = arg.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
		map[camelCase] = `--${arg}`
	}
	return map
}

export function handleValidationError(argumentMap?: Record<string, string>): (e: unknown) => never {
	return (e: unknown) => {
		if (e instanceof RequestValidationError) {
			const issues = e.zodError.issues.map((issue) => {
				const fieldPath = issue.path.join('.')
				const rootField = String(issue.path[0] ?? '')
				const argument = argumentMap?.[rootField] ?? (fieldPath || '(root)')
				return { argument, message: issue.message }
			})
			throw new ArgumentValidationError(issues)
		}
		throw e
	}
}

function formatApiError(e: unknown): void {
	const isVerbose = process.argv.some((arg) => arg === '--verbose')

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

	if (e instanceof Error) {
		console.error(`${chalk.red('Error:')} ${e.message}`)
		if (isVerbose && e.stack) {
			console.error(chalk.dim(e.stack))
		}
	} else {
		console.error(`${chalk.red('Error:')} ${String(e)}`)
	}
}
