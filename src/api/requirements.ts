import { z } from 'zod'
import { ResourceId, sortFieldParam, sortOrderParam, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Requirement {
	id: number
	text: string
	url: string
	tcaseCount?: number
}

export const ListRequirementsRequestSchema = z.object({
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListRequirementsRequest = z.infer<typeof ListRequirementsRequestSchema>

export const createRequirementApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListRequirementsRequest) => {
			const validated = params ? validateRequest(params, ListRequirementsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/requirement`, validated)
			)
				.then((r) => jsonResponse<{ requirements: Requirement[] }>(r))
				.then((r) => r.requirements)
		},
	}
}
