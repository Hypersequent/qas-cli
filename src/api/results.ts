import { ResourceId, ResultStatus } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface CreateResultsRequestItem {
	tcaseId: string
	status: ResultStatus | string
	comment?: string
	timeTaken?: number | null // In milliseconds
}

export interface CreateResultsRequest {
	items: CreateResultsRequestItem[]
}

export interface CreateResultRequest {
	status: string
	comment?: string
	timeTaken?: number | null
	links?: Array<{ text: string; url: string }>
}

export interface CreateResultResponse {
	id: number
}

export const createResultApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		createResults: (projectCode: ResourceId, runId: ResourceId, req: CreateResultsRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/result/batch`, {
				body: JSON.stringify(req),
				method: 'POST',
			}).then((r) => jsonResponse<{ ids: number[] }>(r)),

		createResult: (
			projectCode: ResourceId,
			runId: ResourceId,
			tcaseId: ResourceId,
			req: CreateResultRequest
		) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}/result`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<CreateResultResponse>(r)),
	}
}
