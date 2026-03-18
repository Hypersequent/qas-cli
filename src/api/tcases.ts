import { PaginatedRequest, PaginatedResponse, ResourceId } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface TCase {
	id: string
	legacyId?: string
	seq: number
	title: string
	version: number
	projectId: string
	folderId: number
}

export interface CreateTCasesRequest {
	folderPath: string[]
	tcases: { title: string; tags: string[] }[]
}

export interface CreateTCasesResponse {
	tcases: { id: string; seq: number }[]
}

export interface GetTCasesRequest extends PaginatedRequest {
	folders?: number[]
}

export interface GetTCasesBySeqRequest {
	seqIds: string[]
	page?: number
	limit?: number
}

export interface ListTCasesRequest {
	page?: number
	limit?: number
	folders?: number[]
	tags?: number[]
	priorities?: string[]
	search?: string
	types?: string[]
	draft?: boolean
	sortField?: string
	sortOrder?: string
	include?: string
}

export interface CountTCasesRequest {
	folders?: number[]
	recursive?: boolean
	tags?: number[]
	priorities?: string[]
	draft?: boolean
}

export interface CreateTCaseRequest {
	title: string
	type: 'standalone' | 'template'
	folderId: number
	priority: 'low' | 'medium' | 'high'
	comment?: string
	tags?: string[]
	isDraft?: boolean
	steps?: Array<{
		description: string
		expected?: string
		sharedStepId?: number
	}>
	precondition?: { text: string } | { sharedPreconditionId: number }
	pos?: number
	requirements?: Array<{ text: string; url: string }>
	links?: Array<{ text: string; url: string }>
}

export interface UpdateTCaseRequest {
	title?: string
	priority?: 'low' | 'medium' | 'high'
	comment?: string
	tags?: string[]
	isDraft?: boolean
	steps?: Array<{
		description: string
		expected?: string
		sharedStepId?: number
	}>
	precondition?: { text: string } | { sharedPreconditionId: number }
	requirements?: Array<{ text: string; url: string }>
	links?: Array<{ text: string; url: string }>
}

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

		listTCases: (projectCode: ResourceId, params?: ListTCasesRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/tcase`, params ?? {})).then(
				(r) => jsonResponse<PaginatedResponse<TCase>>(r)
			),

		getTCase: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/${id}`).then((r) =>
				jsonResponse<TCase>(r)
			),

		countTCases: (projectCode: ResourceId, params?: CountTCasesRequest) =>
			fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase/count`, params ?? {})
			).then((r) => jsonResponse<{ count: number }>(r)),

		createTCase: (projectCode: ResourceId, req: CreateTCaseRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<{ id: string; seq: number }>(r)),

		updateTCase: (projectCode: ResourceId, id: ResourceId, req: UpdateTCaseRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<{ message: string }>(r)),
	}
}
