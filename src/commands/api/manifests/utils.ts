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
