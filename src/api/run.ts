import { CreateResultRequest, ResourceId, RunTCase } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface CreateRunRequest {
	title: string
	description?: string
	type: 'static' | 'static_struct' | 'live'
	queryPlans: Array<{
		tcaseIds?: string[]
		folderIds?: number[]
		tagIds?: number[]
		priorities?: string[]
	}>
}

export interface CreateRunResponse {
	id: string
}

export const createRunApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getRunTCases: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase`)
				.then((r) => jsonResponse<{ tcases: RunTCase[] }>(r))
				.then((r) => r.tcases),
		createResultStatus: (
			projectCode: ResourceId,
			runId: ResourceId,
			tcaseId: ResourceId,
			req: CreateResultRequest
		) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}/result`, {
				body: JSON.stringify(req),
				method: 'POST',
			}).then((r) => jsonResponse<{ id: number }>(r)),

		createRun: (projectCode: ResourceId, req: CreateRunRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/run`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<CreateRunResponse>(r)),
	}
}

export type RunApi = ReturnType<typeof createRunApi>
