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

export interface TCase {
	id: string
	legacyId?: string
	seq: number
	title: string
	version: number
	projectId: string
	folderId: number
}

export interface CreateTCasesRequest {
	folderPath: string[]
	tcases: { title: string; tags: string[] }[]
}

export interface CreateTCasesResponse {
	tcases: { id: string; seq: number }[]
}

export interface Folder {
	id: number
	title: string
}

export interface RunTCase {
	id: string
	version: number
	folderId: number
	pos: number
	seq: number
	title: string
	priority: string
	status: string
	folder: Folder
}

export interface CreateResultsRequestItem {
	tcaseId: string
	status: ResultStatus
	comment?: string
}

export interface CreateResultsRequest {
	items: CreateResultsRequestItem[]
}
