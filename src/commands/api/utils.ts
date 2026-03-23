import { existsSync, readFileSync } from 'node:fs'
import chalk from 'chalk'
import { type ArgumentsCamelCase } from 'yargs'
import { ZodError, ZodType } from 'zod'
import { loadEnvs } from '../../utils/env'
import { createApi, Api } from '../../api/index'

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
		} catch {
			throw new Error(`Failed to parse JSON from file ${filePath} for ${optionName}`)
		}
	}

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
	fn: (args: ArgumentsCamelCase<T>, connectApi: () => Api) => Promise<void>
): (args: ArgumentsCamelCase<T>) => Promise<void> {
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

function formatApiError(e: unknown): void {
	const isVerbose = process.argv.some((arg) => arg === '--verbose')

	if (e instanceof Error) {
		console.error(`${chalk.red('Error:')} ${e.message}`)
		if (isVerbose && e.stack) {
			console.error(chalk.dim(e.stack))
		}
	} else {
		console.error(`${chalk.red('Error:')} ${String(e)}`)
	}
}
