import { z } from 'zod'
import { limitParam, offsetParam, sortFieldParam, sortOrderParam } from '../../../api/schemas'
import type { ApiPathParamSpec, ApiQueryOptionSpec } from '../types'

/**
 * Common help text shared across multiple manifest files.
 */
export const commonHelp = {
	'sort-field': 'Field to sort by.',
	'sort-order': 'Sort direction (asc or desc).',
	offset: 'Number of items to skip before returning results (defaults to 0).',
	limit:
		'Maximum number of items to return (0-1000, defaults to 100). Use 0 to return only the total count.',
} as const

/**
 * Pagination and sorting options of a list command. `sortFields` are the fields its endpoint
 * sorts by.
 */
export const paginationOptions = (sortFields: readonly string[]): ApiQueryOptionSpec[] => [
	{ name: 'offset', type: 'number', describe: commonHelp.offset, schema: offsetParam },
	{ name: 'limit', type: 'number', describe: commonHelp.limit, schema: limitParam },
	{
		name: 'sort-field',
		type: 'string',
		describe: commonHelp['sort-field'],
		schema: sortFieldParam,
		helpChoices: sortFields,
	},
	{
		name: 'sort-order',
		type: 'string',
		describe: commonHelp['sort-order'],
		schema: sortOrderParam,
		choices: ['asc', 'desc'],
	},
]

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
	.regex(/^\s*[1-9]\d*\s*(,\s*[1-9]\d*\s*)*$/, 'must be comma-separated positive integers')

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
