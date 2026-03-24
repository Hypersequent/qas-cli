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
	page: number
	limit: number
}

export interface PaginatedRequest {
	page?: number
	limit?: number
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
export const pageParam = z.number().int().positive().optional()
export const limitParam = z.number().int().positive().optional()
