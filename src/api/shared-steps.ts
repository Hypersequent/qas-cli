import { z } from 'zod'
import { ResourceId, sortFieldParam, sortOrderParam, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedStep {
	id: number
	title: string
	tcaseCount?: number
}

export const ListSharedStepsRequestSchema = z.object({
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListSharedStepsRequest = z.infer<typeof ListSharedStepsRequestSchema>

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
	}
}
