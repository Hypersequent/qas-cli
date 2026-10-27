import { z } from 'zod'
import {
	MAX_BULK_ITEMS,
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	paginationParams,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Tag {
	id: number
	title: string
	tcaseCount?: number
}

export const ListTagsRequestSchema = z.object({
	...paginationParams,
	include: z.string().optional(),
})

export type ListTagsRequest = z.infer<typeof ListTagsRequestSchema>

const tagTitle = z
	.string()
	.min(1, 'title must not be empty')
	.max(255, 'title must be at most 255 characters')

export const CreateTagRequestSchema = z.object({
	title: tagTitle,
})

export type CreateTagRequest = z.infer<typeof CreateTagRequestSchema>

export const UpdateTagRequestSchema = z.object({
	title: tagTitle,
})

export type UpdateTagRequest = z.infer<typeof UpdateTagRequestSchema>

export const RenameTagsRequestSchema = z.object({
	tags: z
		.array(
			z.object({
				id: z.number().int().positive('id must be a positive integer'),
				title: tagTitle,
			})
		)
		.min(1, 'Must contain at least one tag')
		.max(MAX_BULK_ITEMS, `Must contain at most ${MAX_BULK_ITEMS} tags`),
})

export type RenameTagsRequest = z.infer<typeof RenameTagsRequestSchema>

export const DeleteTagsRequestSchema = z.object({
	tagIds: z
		.array(z.number().int().positive('tag IDs must be positive integers'))
		.min(1, 'Must contain at least one tag ID')
		.max(MAX_BULK_ITEMS, `Must contain at most ${MAX_BULK_ITEMS} tag IDs`),
})

export type DeleteTagsRequest = z.infer<typeof DeleteTagsRequestSchema>

export const createTagApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListTagsRequest) => {
			const validated = params ? validateRequest(params, ListTagsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tag/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<Tag>>(r))
		},

		create: async (projectCode: ResourceId, req: CreateTagRequest) => {
			const validated = validateRequest(req, CreateTagRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tag`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Tag>(r))
		},

		update: async (projectCode: ResourceId, tagId: ResourceId, req: UpdateTagRequest) => {
			const validated = validateRequest(req, UpdateTagRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tag/${tagId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Tag>(r))
		},

		rename: async (projectCode: ResourceId, req: RenameTagsRequest) => {
			const validated = validateRequest(req, RenameTagsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tag`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ tags: Tag[] }>(r))
		},

		delete: async (projectCode: ResourceId, req: DeleteTagsRequest) => {
			const validated = validateRequest(req, DeleteTagsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tag/delete`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},
	}
}
