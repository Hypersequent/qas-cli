import {
	CreateTCasesRequest,
	CreateTCasesResponse,
	GetTCasesBySeqRequest,
	GetTCasesRequest,
	PaginatedResponse,
	ResourceId,
	TCase,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export const createTCaseApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getTCasesPaginated: (projectCode: ResourceId, request: GetTCasesRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/tcase`, request)).then(
				(r) => jsonResponse<PaginatedResponse<TCase>>(r)
			),

		getTCasesBySeq: (projectCode: ResourceId, request: GetTCasesBySeqRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/seq`, {
				method: 'POST',
				body: JSON.stringify(request),
			}).then((r) => jsonResponse<PaginatedResponse<TCase>>(r)),

		createTCases: (projectCode: ResourceId, request: CreateTCasesRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/bulk`, {
				method: 'POST',
				body: JSON.stringify(request),
			}).then((r) => jsonResponse<CreateTCasesResponse>(r)),
	}
}
