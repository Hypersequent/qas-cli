import { ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedPrecondition {
	id: number
	title: string
	tcaseCount?: number
}

export interface ListSharedPreconditionsRequest {
	sortField?: string
	sortOrder?: string
	include?: string
}

export const createSharedPreconditionApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		listSharedPreconditions: (projectCode: ResourceId, params?: ListSharedPreconditionsRequest) =>
			fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/shared-precondition`,
					params ?? {}
				)
			).then((r) => jsonResponse<SharedPrecondition[]>(r)),

		getSharedPrecondition: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-precondition/${id}`).then((r) =>
				jsonResponse<SharedPrecondition>(r)
			),
	}
}
