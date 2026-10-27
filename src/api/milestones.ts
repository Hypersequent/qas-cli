import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	paginationParams,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Milestone {
	id: number
	title: string
	createdAt: string
	updatedAt: string
	archivedAt: string | null
	archivedBy: number | null
}

export interface ArchivedMilestone extends Milestone {
	closedPlans: number
	closedRuns: number
}

export const ListMilestonesRequestSchema = z.object({
	...paginationParams,
	archived: z.boolean().optional(),
})

export type ListMilestonesRequest = z.infer<typeof ListMilestonesRequestSchema>

export const CreateMilestoneRequestSchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
})

export type CreateMilestoneRequest = z.infer<typeof CreateMilestoneRequestSchema>

export const UpdateMilestoneRequestSchema = z.object({
	title: CreateMilestoneRequestSchema.shape.title.optional(),
})

export type UpdateMilestoneRequest = z.infer<typeof UpdateMilestoneRequestSchema>

export const createMilestoneApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListMilestonesRequest) => {
			const validated = params ? validateRequest(params, ListMilestonesRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/milestone/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<Milestone>>(r))
		},

		create: async (projectCode: ResourceId, req: CreateMilestoneRequest) => {
			const validated = validateRequest(req, CreateMilestoneRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/milestone`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ id: number }>(r))
		},

		get: (projectCode: ResourceId, milestoneId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/milestone/${milestoneId}`).then((r) =>
				jsonResponse<Milestone>(r)
			),

		update: async (
			projectCode: ResourceId,
			milestoneId: ResourceId,
			req: UpdateMilestoneRequest
		) => {
			const validated = validateRequest(req, UpdateMilestoneRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/milestone/${milestoneId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Milestone>(r))
		},

		archive: (projectCode: ResourceId, milestoneId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/milestone/${milestoneId}/archive`, {
				method: 'POST',
			}).then((r) => jsonResponse<ArchivedMilestone>(r)),

		unarchive: (projectCode: ResourceId, milestoneId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/milestone/${milestoneId}/unarchive`, {
				method: 'POST',
			}).then((r) => jsonResponse<Milestone>(r)),

		delete: (projectCode: ResourceId, milestoneId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/milestone/${milestoneId}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
