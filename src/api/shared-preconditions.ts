import { z } from 'zod'
import { ResourceId, sortFieldParam, sortOrderParam, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedPrecondition {
	id: number
	title: string
	tcaseCount?: number
}

export const ListSharedPreconditionsRequestSchema = z.object({
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListSharedPreconditionsRequest = z.infer<typeof ListSharedPreconditionsRequestSchema>

export const createSharedPreconditionApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListSharedPreconditionsRequest) => {
			const validated = params ? validateRequest(params, ListSharedPreconditionsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/shared-precondition`, validated)
			).then((r) => jsonResponse<SharedPrecondition[]>(r))
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-precondition/${id}`).then((r) =>
				jsonResponse<SharedPrecondition>(r)
			),
	}
}
