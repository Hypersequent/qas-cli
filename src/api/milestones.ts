import { ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Milestone {
	id: number
	title: string
	archived: boolean
}

export interface ListMilestonesRequest {
	archived?: boolean
}

export interface CreateMilestoneRequest {
	title: string
}

export const createMilestoneApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: (projectCode: ResourceId, params?: ListMilestonesRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/milestone`, params ?? {}))
				.then((r) => jsonResponse<{ milestones: Milestone[] }>(r))
				.then((r) => r.milestones),

		create: (projectCode: ResourceId, req: CreateMilestoneRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/milestone`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<{ id: number }>(r)),
	}
}
