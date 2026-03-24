import { ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Requirement {
	id: number
	text: string
	tcaseCount?: number
}

export interface ListRequirementsRequest {
	sortField?: string
	sortOrder?: string
	include?: string
}

export const createRequirementApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: (projectCode: ResourceId, params?: ListRequirementsRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/requirement`, params ?? {}))
				.then((r) => jsonResponse<{ requirements: Requirement[] }>(r))
				.then((r) => r.requirements),
	}
}
