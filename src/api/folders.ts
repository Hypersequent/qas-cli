import { z } from 'zod'
import {
	PaginatedResponse,
	ResourceId,
	limitParam,
	offsetParam,
	pageParam,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
import type { TrashEntry } from './trash'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Folder {
	id: number
	title: string
	comment: string
	pos: number
	parentId: number
	projectId: string
}

export interface FolderTreeNode extends Folder {
	tcaseCount?: number
	children?: FolderTreeNode[]
}

export interface FolderListResponse<T> {
	folders: T[]
}

export interface FolderIdsResponse {
	folders: Array<{ id: number }>
}

export const GetFoldersRequestSchema = z.object({
	offset: offsetParam,
	page: pageParam,
	limit: limitParam,
	search: z.string().optional(),
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
})

export type GetFoldersRequest = z.infer<typeof GetFoldersRequestSchema>

export const BulkCreateFoldersRequestSchema = z
	.array(
		z.object({
			path: z.array(z.string()).min(1, 'path must have at least one element'),
			comment: z.string().optional(),
		})
	)
	.min(1, 'Must contain at least one folder')

export type BulkCreateFoldersRequest = z.infer<typeof BulkCreateFoldersRequestSchema>

export interface BulkCreateFoldersResponse {
	ids: number[][]
}

export const GetFolderTreeRequestSchema = z.object({
	include: z.enum(['tcaseCount']).optional(),
})

export type GetFolderTreeRequest = z.infer<typeof GetFolderTreeRequestSchema>

const folderTitle = z
	.string()
	.min(1, 'title must not be empty')
	.max(255, 'title must be at most 255 characters')

const folderIdList = z
	.array(z.number().int().positive('folder IDs must be positive integers'))
	.min(1, 'Must contain at least one folder')

export const CreateFolderRequestSchema = z.object({
	title: folderTitle,
	parentId: z.number().int().nonnegative('parentId must be a non-negative integer').optional(),
	pos: z.number().int().nonnegative('pos must be a non-negative integer').optional(),
	comment: z.string().optional(),
})

export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>

export const UpdateFolderRequestSchema = z
	.object({
		title: folderTitle.optional(),
		comment: z.string().optional(),
	})
	.refine((req) => req.title !== undefined || req.comment !== undefined, {
		message: 'title or comment is required',
	})

export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>

export const FolderPositionsSchema = z
	.array(
		z.object({
			id: z.number().int().positive('id must be a positive integer'),
			pos: z.number().int('pos must be an integer'),
		})
	)
	.min(1, 'Must contain at least one item')

export const MoveFoldersRequestSchema = z.object({
	newParentId: z.number().int().nonnegative('newParentId must be a non-negative integer'),
	items: FolderPositionsSchema,
})

export type MoveFoldersRequest = z.infer<typeof MoveFoldersRequestSchema>

export const CopyFoldersRequestSchema = z.object({
	folderIds: folderIdList,
	targetFolderId: z
		.number()
		.int()
		.nonnegative('targetFolderId must be a non-negative integer')
		.optional(),
	sourceProjectId: z.string().min(1, 'sourceProjectId must not be empty').optional(),
})

export type CopyFoldersRequest = z.infer<typeof CopyFoldersRequestSchema>

export const DeleteFoldersRequestSchema = z.object({
	folderIds: folderIdList,
	tcaseIds: z.array(z.string().min(1, 'test case IDs must not be empty')).optional(),
})

export type DeleteFoldersRequest = z.infer<typeof DeleteFoldersRequestSchema>

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
				body: JSON.stringify({ folders: validated }),
			}).then((r) => jsonResponse<BulkCreateFoldersResponse>(r))
		},

		get: (projectCode: ResourceId, folderId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/folder/${folderId}`).then((r) =>
				jsonResponse<Folder>(r)
			),

		getTree: async (projectCode: ResourceId, request: GetFolderTreeRequest) => {
			const validated = validateRequest(request, GetFolderTreeRequestSchema)
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/folder/tree`, validated)
			).then((r) => jsonResponse<FolderListResponse<FolderTreeNode>>(r))
		},

		getPath: (projectCode: ResourceId, folderId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/folder/${folderId}/path`).then((r) =>
				jsonResponse<FolderListResponse<Folder>>(r)
			),

		create: async (projectCode: ResourceId, req: CreateFolderRequest) => {
			const validated = validateRequest(req, CreateFolderRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/folder`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Folder>(r))
		},

		update: async (projectCode: ResourceId, folderId: ResourceId, req: UpdateFolderRequest) => {
			const validated = validateRequest(req, UpdateFolderRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/folder/${folderId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Folder>(r))
		},

		move: async (projectCode: ResourceId, req: MoveFoldersRequest) => {
			const validated = validateRequest(req, MoveFoldersRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/folder/location`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<FolderIdsResponse>(r))
		},

		copy: async (projectCode: ResourceId, req: CopyFoldersRequest) => {
			const validated = validateRequest(req, CopyFoldersRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/folder/copy`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<FolderIdsResponse>(r))
		},

		delete: async (projectCode: ResourceId, req: DeleteFoldersRequest) => {
			const validated = validateRequest(req, DeleteFoldersRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/folder/delete`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<TrashEntry>(r))
		},
	}
}

export type FolderApi = ReturnType<typeof createFolderApi>
