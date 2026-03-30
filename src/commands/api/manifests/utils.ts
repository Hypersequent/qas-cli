import { z } from 'zod'
import type { ApiPathParamSpec } from '../types'

/**
 * Common help text shared across multiple manifest files.
 */
export const commonHelp = {
	'project-code': 'Project code identifying the QA Sphere project.',
	'sort-field': 'Field to sort by (e.g., "title", "createdAt", "updatedAt").',
	'sort-order': 'Sort direction (asc or desc).',
	page: 'Page number for pagination (starts at 1).',
	limit: 'Maximum number of items per page.',
} as const

/**
 * Reusable project-code path parameter with validation.
 */
export const projectCodeParam: ApiPathParamSpec = {
	name: 'project-code',
	type: 'string',
	describe: commonHelp['project-code'],
	schema: z.string().regex(/^[a-zA-Z0-9]+$/, 'must contain only latin letters and digits'),
}
