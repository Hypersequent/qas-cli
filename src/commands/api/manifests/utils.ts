import { z } from 'zod'
import type { ApiPathParamSpec } from '../types'

/**
 * Common help text shared across multiple manifest files.
 */
export const commonHelp = {
	'sort-field': 'Field to sort by (e.g., "title", "createdAt", "updatedAt").',
	'sort-order': 'Sort direction (asc or desc).',
	offset: 'Number of items to skip before returning results (defaults to 0).',
	page: '[Deprecated] Use --offset instead. Page number for pagination (starts at 1). Ignored when --offset is set.',
	limit: 'Maximum number of items to return (0-5000). Use 0 to return only the total count.',
} as const

/**
 * Reusable project-code path parameter with validation.
 */
export const projectCodeParam: ApiPathParamSpec = {
	name: 'project-code',
	type: 'string',
	describe: 'Project code identifying the QA Sphere project.',
	schema: z.string().regex(/^[a-zA-Z0-9]+$/, 'must contain only latin letters and digits'),
}

/**
 * Positive-integer ID path parameter, e.g. a folder or tag ID.
 */
export const intIdParam = (name: string, describe: string): ApiPathParamSpec => ({
	name,
	type: 'number',
	describe,
	schema: z.number().int().positive('must be a positive integer'),
})

/**
 * Comma-separated lists are validated as text, then split by `splitList`/`splitIntList`
 * in `transformFields` or `transformQuery`.
 */
export const intListSchema = z
	.string()
	.regex(/^\s*\d+\s*(,\s*\d+\s*)*$/, 'must be comma-separated positive integers')

export const idListSchema = z
	.string()
	.regex(
		/^\s*[a-zA-Z0-9_-]+\s*(,\s*[a-zA-Z0-9_-]+\s*)*$/,
		'must be comma-separated IDs (letters, digits, dashes and underscores)'
	)

export const splitList = (value: unknown): unknown =>
	typeof value === 'string'
		? value
				.split(',')
				.map((item) => item.trim())
				.filter((item) => item !== '')
		: value

export const splitIntList = (value: unknown): unknown => {
	const items = splitList(value)
	return Array.isArray(items) ? items.map(Number) : items
}
