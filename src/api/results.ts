import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { jsonResponse, withJson } from './utils'

const resultStatusEnum = z.enum([
	'passed',
	'failed',
	'blocked',
	'skipped',
	'open',
	'custom1',
	'custom2',
	'custom3',
	'custom4',
])

export const resultLinksSchema = z.array(
	z.object({
		text: z.string(),
		url: z.string().url(),
	})
)

export const CreateResultsRequestItemSchema = z.object({
	tcaseId: z.string(),
	status: resultStatusEnum,
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative().nullable().optional(),
	links: resultLinksSchema.optional(),
})

export type CreateResultsRequestItem = z.infer<typeof CreateResultsRequestItemSchema>

export const CreateResultsRequestSchema = z.object({
	items: z.array(CreateResultsRequestItemSchema).min(1, 'Must contain at least one result item'),
})

export type CreateResultsRequest = z.infer<typeof CreateResultsRequestSchema>

export const CreateResultRequestSchema = z.object({
	status: resultStatusEnum,
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative().nullable().optional(),
	links: resultLinksSchema.optional(),
})

export type CreateResultRequest = z.infer<typeof CreateResultRequestSchema>

export interface CreateResultResponse {
	id: number
}

export const createResultApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		createBatch: async (projectCode: ResourceId, runId: ResourceId, req: CreateResultsRequest) => {
			const validated = validateRequest(req, CreateResultsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/result/batch`, {
				body: JSON.stringify(validated),
				method: 'POST',
			}).then((r) => jsonResponse<{ ids: number[] }>(r))
		},

		create: async (
			projectCode: ResourceId,
			runId: ResourceId,
			tcaseId: ResourceId,
			req: CreateResultRequest
		) => {
			const validated = validateRequest(req, CreateResultRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}/result`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<CreateResultResponse>(r))
		},
	}
}
