import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { RunSchema } from './runs'
import { jsonResponse, withJson } from './utils'

export const CreateTestPlanRequestSchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	description: z.string().optional(),
	milestoneId: z.number().int().positive().optional(),
	runs: z.array(RunSchema).min(1, 'Must contain at least one run'),
})

export type CreateTestPlanRequest = z.infer<typeof CreateTestPlanRequestSchema>

export interface CreateTestPlanResponse {
	id: number
}

export const createTestPlanApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		create: async (projectCode: ResourceId, req: CreateTestPlanRequest) => {
			const validated = validateRequest(req, CreateTestPlanRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/plan`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<CreateTestPlanResponse>(r))
		},
	}
}
