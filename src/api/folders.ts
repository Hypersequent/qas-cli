import { Folder, PaginatedRequest, PaginatedResponse, ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export const createFolderApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getFoldersPaginated: (projectCode: ResourceId, request: PaginatedRequest) =>
			fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase/folders`, request)
			).then((r) => jsonResponse<PaginatedResponse<Folder>>(r)),
	}
}

export type FolderApi = ReturnType<typeof createFolderApi>
