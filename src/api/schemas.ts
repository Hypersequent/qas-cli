export type ResourceId = string | number

export type ResultStatus = 'open' | 'passed' | 'blocked' | 'failed' | 'skipped'

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
