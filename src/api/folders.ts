import { PaginatedResponse, ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Folder {
	id: number
	parentId: number
	pos: number
	title: string
}

export interface GetFoldersRequest {
	page?: number
	limit?: number
	search?: string
	sortField?: string
	sortOrder?: string
}

export interface BulkCreateFoldersRequest {
	folders: Array<{
		path: string[]
		comment?: string
	}>
}

export interface BulkCreateFoldersResponse {
	ids: number[][]
}

export const createFolderApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getFoldersPaginated: (projectCode: ResourceId, request: GetFoldersRequest) =>
			fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase/folders`, request)
			).then((r) => jsonResponse<PaginatedResponse<Folder>>(r)),

		bulkCreateFolders: (projectCode: ResourceId, req: BulkCreateFoldersRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/folder/bulk`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<BulkCreateFoldersResponse>(r)),
	}
}

export type FolderApi = ReturnType<typeof createFolderApi>
