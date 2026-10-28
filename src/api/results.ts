import { z } from 'zod'
import {
	MAX_BULK_ITEMS,
	ResourceId,
	httpUrlSchema,
	resultStatusEnum,
	validateRequest,
} from './schemas'
import { jsonResponse, withJson } from './utils'

// A result holds at most 5 links, and a batch request at most 100 across its results.
export const MAX_RESULT_LINKS = 5
export const MAX_REQUEST_LINKS = 100

export const resultLinksSchema = z
	.array(
		z.object({
			integrationId: z.string().min(1, 'integrationId must not be empty'),
			url: httpUrlSchema,
			text: z.string(),
			// The issue's ID in Jira, GitHub (the issue number) or Linear, which they need for the
			// reference back to the result; custom integrations' links don't need it.
			meta: z
				.object({ id: z.string().min(1, 'meta.id must not be empty') })
				.strict()
				.optional(),
		})
	)
	.max(MAX_RESULT_LINKS, `Must contain at most ${MAX_RESULT_LINKS} links`)

export const CreateResultsRequestItemSchema = z.object({
	tcaseId: z.string(),
	status: resultStatusEnum,
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative().nullable().optional(),
	links: resultLinksSchema.optional(),
})

export type CreateResultsRequestItem = z.infer<typeof CreateResultsRequestItemSchema>

export const CreateResultsRequestSchema = z.object({
	items: z
		.array(CreateResultsRequestItemSchema)
		.min(1, 'Must contain at least one result item')
		.max(MAX_BULK_ITEMS, `Must contain at most ${MAX_BULK_ITEMS} result items`)
		.refine(
			(items) => items.reduce((n, item) => n + (item.links?.length ?? 0), 0) <= MAX_REQUEST_LINKS,
			`Must contain at most ${MAX_REQUEST_LINKS} links across the result items`
		),
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

export interface Result {
	id: number
	tcaseId: string
	status: string
	comment: string
	links: {
		id: number
		resultId: number
		integrationId: string | null
		integration: Record<string, unknown> | null
		url: string
		text: string
		meta: Record<string, string> | null
	}[]
	[key: string]: unknown
}

export const UpdateResultRequestSchema = z.object({
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative('timeTaken must be a non-negative integer').optional(),
	createLinks: resultLinksSchema.optional(),
	deleteLinkIds: z
		.array(z.number().int().positive('link IDs must be positive integers'))
		.optional(),
})

export type UpdateResultRequest = z.infer<typeof UpdateResultRequestSchema>

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

		get: (projectCode: ResourceId, runId: ResourceId, resultId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/result/${resultId}`).then((r) =>
				jsonResponse<Result>(r)
			),

		update: async (
			projectCode: ResourceId,
			runId: ResourceId,
			resultId: ResourceId,
			req: UpdateResultRequest
		) => {
			const validated = validateRequest(req, UpdateResultRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/result/${resultId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Result>(r))
		},
	}
}
