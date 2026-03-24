import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Milestone {
	id: number
	title: string
	archived: boolean
}

export const ListMilestonesRequestSchema = z.object({
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

export const createMilestoneApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListMilestonesRequest) => {
			const validated = params ? validateRequest(params, ListMilestonesRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/milestone`, validated)
			)
				.then((r) => jsonResponse<{ milestones: Milestone[] }>(r))
				.then((r) => r.milestones)
		},

		create: async (projectCode: ResourceId, req: CreateMilestoneRequest) => {
			const validated = validateRequest(req, CreateMilestoneRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/milestone`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ id: number }>(r))
		},
	}
}
