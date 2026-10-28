import { z, ZodError, ZodType } from 'zod'

export type ResourceId = string | number

export type ResultStatus =
	| 'open'
	| 'passed'
	| 'blocked'
	| 'failed'
	| 'skipped'
	| 'custom1'
	| 'custom2'
	| 'custom3'
	| 'custom4'

export interface PaginatedResponse<T> {
	data: T[]
	total: number
	offset: number
	limit: number
}

export interface MessageResponse {
	message: string
}

export class RequestValidationError extends Error {
	constructor(
		public readonly zodError: ZodError,
		public readonly rawValue: unknown
	) {
		super(zodError.message)
		this.name = 'RequestValidationError'
	}
}

export function validateRequest<T>(value: unknown, schema: ZodType<T>): T {
	try {
		return schema.parse(value)
	} catch (e) {
		if (e instanceof ZodError) {
			throw new RequestValidationError(e, value)
		}
		throw e
	}
}

export const sortFieldParam = z.string().optional()
export const sortOrderParam = z.enum(['asc', 'desc']).optional()
export type SortOrder = z.infer<typeof sortOrderParam>
export const offsetParam = z.number().int().nonnegative().optional()
// The paginated endpoints return at most 1,000 rows a page
export const MAX_PAGE_SIZE = 1000
// Bulk endpoints take at most 1,000 items a request
export const MAX_BULK_ITEMS = 1000
// Limit 0 is valid and returns only the total count (no rows)
export const limitParam = z
	.number()
	.int()
	.nonnegative()
	.max(MAX_PAGE_SIZE, `must be at most ${MAX_PAGE_SIZE}`)
	.optional()
export const paginationParams = {
	offset: offsetParam,
	limit: limitParam,
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
}
// The API takes http and https URLs only.
export const httpUrlSchema = z
	.url({ protocol: /^https?$/, error: 'must be an http or https URL' })
	.max(255, 'must be at most 255 characters')
export const linkSchema = z.object({
	text: z.string().min(1, 'text must not be empty').max(255, 'text must be at most 255 characters'),
	url: httpUrlSchema,
})
export const priorityEnum = z.enum(['low', 'medium', 'high'])
export const resultStatusEnum = z.enum([
	'passed',
	'failed',
	'blocked',
	'skipped',
	'open',
	'custom1',
	'custom2',
	'custom3',
	'custom4',
])
// How several values of one filter combine.
export const filterOpEnum = z.enum(['or', 'and', 'not'])
export const automationResultEnum = z.enum([
	'automated_passing',
	'automated_failing',
	'has_automated',
	'has_manual',
])
export const tcaseTypeEnum = z.enum(['standalone', 'template', 'filled'])
export const resourceIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9_-]+$/, 'must contain only alphanumeric characters, dashes, and underscores')
