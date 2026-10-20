import { z } from 'zod'
import {
	MessageResponse,
	ResourceId,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedSubStep {
	id: number
	version: number
	type: string
	description?: string
	expected?: string
	data?: unknown[]
	isLatest: boolean
}

export interface SharedStep {
	id: number
	title: string
	version?: number
	type?: string
	isLatest?: boolean
	subSteps?: SharedSubStep[]
	tcaseCount?: number
}

export const ListSharedStepsRequestSchema = z.object({
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListSharedStepsRequest = z.infer<typeof ListSharedStepsRequestSchema>

const sharedStepTitleSchema = z
	.string()
	.min(1, 'title must not be empty')
	.max(255, 'title must be at most 255 characters')

const subStepFields = {
	description: z.string().optional(),
	expected: z.string().optional(),
	data: z.array(z.unknown()).max(20, 'data must have at most 20 items').optional(),
}

export const CreateSubStepsSchema = z
	.array(z.object(subStepFields))
	.min(1, 'subSteps must have at least one sub-step')

export const UpdateSubStepsSchema = z.array(
	z.object({ id: z.number().int().positive().optional(), ...subStepFields })
)

export const CreateSharedStepRequestSchema = z.object({
	title: sharedStepTitleSchema,
	subSteps: CreateSubStepsSchema,
})

export type CreateSharedStepRequest = z.infer<typeof CreateSharedStepRequestSchema>

export const UpdateSharedStepRequestSchema = z.object({
	title: sharedStepTitleSchema.optional(),
	subSteps: UpdateSubStepsSchema.optional(),
})

export type UpdateSharedStepRequest = z.infer<typeof UpdateSharedStepRequestSchema>

export const createSharedStepApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListSharedStepsRequest) => {
			const validated = params ? validateRequest(params, ListSharedStepsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/shared-step`, validated)
			)
				.then((r) => jsonResponse<{ sharedSteps: SharedStep[] }>(r))
				.then((r) => r.sharedSteps)
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-step/${id}`).then((r) =>
				jsonResponse<SharedStep>(r)
			),

		create: async (projectCode: ResourceId, req: CreateSharedStepRequest) => {
			const validated = validateRequest(req, CreateSharedStepRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/shared-step`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<SharedStep>(r))
		},

		update: async (projectCode: ResourceId, id: ResourceId, req: UpdateSharedStepRequest) => {
			const validated = validateRequest(req, UpdateSharedStepRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/shared-step/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<SharedStep>(r))
		},

		delete: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-step/${id}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
