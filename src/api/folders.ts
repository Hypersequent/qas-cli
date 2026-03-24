import { z } from 'zod'
import {
	PaginatedResponse,
	ResourceId,
	limitParam,
	pageParam,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Folder {
	id: number
	parentId: number
	pos: number
	title: string
}

export const GetFoldersRequestSchema = z.object({
	page: pageParam,
	limit: limitParam,
	search: z.string().optional(),
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
})

export type GetFoldersRequest = z.infer<typeof GetFoldersRequestSchema>

export const BulkCreateFoldersRequestSchema = z.object({
	folders: z
		.array(
			z.object({
				path: z.array(z.string()).min(1, 'path must have at least one element'),
				comment: z.string().optional(),
			})
		)
		.min(1, 'Must contain at least one folder'),
})

export type BulkCreateFoldersRequest = z.infer<typeof BulkCreateFoldersRequestSchema>

export interface BulkCreateFoldersResponse {
	ids: number[][]
}

export const createFolderApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getPaginated: async (projectCode: ResourceId, request: GetFoldersRequest) => {
			const validated = validateRequest(request, GetFoldersRequestSchema)
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase/folders`, validated)
			).then((r) => jsonResponse<PaginatedResponse<Folder>>(r))
		},

		bulkCreate: async (projectCode: ResourceId, req: BulkCreateFoldersRequest) => {
			const validated = validateRequest(req, BulkCreateFoldersRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tcase/folder/bulk`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<BulkCreateFoldersResponse>(r))
		},
	}
}

export type FolderApi = ReturnType<typeof createFolderApi>
