import { MessageResponse, ResourceId } from './schemas'
import { Folder } from './folders'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface RunTCase {
	id: string
	version: number
	folderId: number
	pos: number
	seq: number
	title: string
	priority: string
	status: string
	folder: Folder
}

export interface CreateRunRequest {
	title: string
	description?: string
	type: 'static' | 'static_struct' | 'live'
	milestoneId?: number
	configurationId?: string
	assignmentId?: number
	queryPlans: Array<{
		tcaseIds?: string[]
		folderIds?: number[]
		tagIds?: number[]
		priorities?: string[]
	}>
}

export interface CreateRunResponse {
	id: number
}

export interface ListRunsRequest {
	closed?: boolean
	milestoneIds?: number[]
	limit?: number
}

export interface Run {
	id: number
	title: string
	description?: string
	type: string
	closed: boolean
}

export interface CloneRunRequest {
	runId: number
	title: string
	description?: string
	milestoneId?: number
	assignmentId?: number
}

export interface CloneRunResponse {
	id: number
}

export interface ListRunTCasesRequest {
	search?: string
	tags?: number[]
	priorities?: string[]
	limit?: number
	include?: string
	sortField?: string
	sortOrder?: string
}

export const createRunApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getRunTCases: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase`)
				.then((r) => jsonResponse<{ tcases: RunTCase[] }>(r))
				.then((r) => r.tcases),

		createRun: (projectCode: ResourceId, req: CreateRunRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/run`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<CreateRunResponse>(r)),

		listRuns: (projectCode: ResourceId, params?: ListRunsRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/run`, params ?? {}))
				.then((r) => jsonResponse<{ runs: Run[] }>(r))
				.then((r) => r.runs),

		cloneRun: (projectCode: ResourceId, req: CloneRunRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/clone`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<CloneRunResponse>(r)),

		closeRun: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/close`, {
				method: 'POST',
			}).then((r) => jsonResponse<MessageResponse>(r)),

		listRunTCases: (projectCode: ResourceId, runId: ResourceId, params?: ListRunTCasesRequest) =>
			fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/run/${runId}/tcase`, params ?? {})
			).then((r) => jsonResponse<{ tcases: RunTCase[] }>(r)),

		getRunTCase: (projectCode: ResourceId, runId: ResourceId, tcaseId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}`).then((r) =>
				jsonResponse<RunTCase>(r)
			),
	}
}
