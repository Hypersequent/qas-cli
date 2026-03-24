import { ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface SharedStep {
	id: number
	title: string
	tcaseCount?: number
}

export interface ListSharedStepsRequest {
	sortField?: string
	sortOrder?: string
	include?: string
}

export const createSharedStepApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: (projectCode: ResourceId, params?: ListSharedStepsRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/shared-step`, params ?? {}))
				.then((r) => jsonResponse<{ sharedSteps: SharedStep[] }>(r))
				.then((r) => r.sharedSteps),

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/shared-step/${id}`).then((r) =>
				jsonResponse<SharedStep>(r)
			),
	}
}
