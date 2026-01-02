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

export interface GetTCasesRequest extends PaginatedRequest {
	folders?: number[]
}

export interface GetTCasesBySeqRequest {
	seqIds: string[]
	page?: number
	limit?: number
}

export interface GetFoldersRequest extends PaginatedRequest {
	search?: string
}

export interface Folder {
	id: number
	parentId: number
	pos: number
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
	timeTaken: number | null // In milliseconds
}

export interface CreateResultsRequest {
	items: CreateResultsRequestItem[]
}
