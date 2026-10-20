import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	paginationParams,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedPrecondition {
	id: number
	title: string
	projectId?: string
	version?: number
	type?: string
	text?: string
	isLatest?: boolean
	createdAt?: string
	updatedAt?: string
	tcaseCount?: number
}

export const ListSharedPreconditionsRequestSchema = z.object({
	...paginationParams,
	include: z.string().optional(),
})

export type ListSharedPreconditionsRequest = z.infer<typeof ListSharedPreconditionsRequestSchema>

const preconditionTitleSchema = z
	.string()
	.min(1, 'title must not be empty')
	.max(255, 'title must be at most 255 characters')

const preconditionTextSchema = z.string().min(1, 'text must not be empty')

export const CreateSharedPreconditionRequestSchema = z.object({
	title: preconditionTitleSchema,
	text: preconditionTextSchema,
})

export type CreateSharedPreconditionRequest = z.infer<typeof CreateSharedPreconditionRequestSchema>

export const UpdateSharedPreconditionRequestSchema = z.object({
	title: preconditionTitleSchema.optional(),
	text: preconditionTextSchema.optional(),
})

export type UpdateSharedPreconditionRequest = z.infer<typeof UpdateSharedPreconditionRequestSchema>

export const createSharedPreconditionApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListSharedPreconditionsRequest) => {
			const validated = params ? validateRequest(params, ListSharedPreconditionsRequestSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/shared-precondition/paginated`,
					validated
				)
			).then((r) => jsonResponse<PaginatedResponse<SharedPrecondition>>(r))
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-precondition/${id}`).then((r) =>
				jsonResponse<SharedPrecondition>(r)
			),

		create: async (projectCode: ResourceId, req: CreateSharedPreconditionRequest) => {
			const validated = validateRequest(req, CreateSharedPreconditionRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/shared-precondition`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<SharedPrecondition>(r))
		},

		update: async (
			projectCode: ResourceId,
			id: ResourceId,
			req: UpdateSharedPreconditionRequest
		) => {
			const validated = validateRequest(req, UpdateSharedPreconditionRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/shared-precondition/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<SharedPrecondition>(r))
		},

		delete: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-precondition/${id}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
