export type ResourceId = string | number

export type ResultStatus = 'open' | 'passed' | 'blocked' | 'failed' | 'skipped'

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
