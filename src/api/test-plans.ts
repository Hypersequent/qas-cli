import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface CreateTestPlanRequest {
	title: string
	description?: string
	milestoneId?: number
	runs: Array<{
		title: string
		description?: string
		type: 'static' | 'static_struct' | 'live'
		configurationId?: string
		assignmentId?: number
		queryPlans: Array<{
			tcaseIds?: string[]
			folderIds?: number[]
			tagIds?: number[]
			priorities?: string[]
		}>
	}>
}

export interface CreateTestPlanResponse {
	id: number
}

export const createTestPlanApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		createTestPlan: (projectCode: ResourceId, req: CreateTestPlanRequest) =>
			fetcher(encodeURI(`/api/public/v0/project/${projectCode}/plan`), {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<CreateTestPlanResponse>(r)),
	}
}
