import { z } from 'zod'
import {
	PaginatedResponse,
	ResourceId,
	limitParam,
	pageParam,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
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

export const CreateTCasesBatchRequestSchema = z.object({
	folderPath: z.array(z.string()),
	tcases: z.array(z.object({ title: z.string(), tags: z.array(z.string()) })),
})

export type CreateTCasesRequest = z.infer<typeof CreateTCasesBatchRequestSchema>

export interface CreateTCasesResponse {
	tcases: { id: string; seq: number }[]
}

export const GetTCasesRequestSchema = z.object({
	page: pageParam,
	limit: limitParam,
	folders: z.array(z.number()).optional(),
})

export type GetTCasesRequest = z.infer<typeof GetTCasesRequestSchema>

export const GetTCasesBySeqRequestSchema = z.object({
	seqIds: z.array(z.string()),
	page: pageParam,
	limit: limitParam,
})

export type GetTCasesBySeqRequest = z.infer<typeof GetTCasesBySeqRequestSchema>

export const ListTCasesRequestSchema = z.object({
	page: pageParam,
	limit: limitParam,
	folders: z.array(z.number()).optional(),
	tags: z.array(z.number()).optional(),
	priorities: z.array(z.string()).optional(),
	search: z.string().optional(),
	types: z.array(z.string()).optional(),
	draft: z.boolean().optional(),
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListTCasesRequest = z.infer<typeof ListTCasesRequestSchema>

export const CountTCasesRequestSchema = z.object({
	folders: z.array(z.number()).optional(),
	recursive: z.boolean().optional(),
	tags: z.array(z.number()).optional(),
	priorities: z.array(z.string()).optional(),
	draft: z.boolean().optional(),
})

export type CountTCasesRequest = z.infer<typeof CountTCasesRequestSchema>

const preconditionSchema = z.union([
	z.object({ text: z.string() }),
	z.object({ sharedPreconditionId: z.number().int().positive() }),
])

const stepSchema = z.object({
	description: z.string(),
	expected: z.string().optional(),
	sharedStepId: z.number().int().positive().optional(),
})

export const StepsArraySchema = z.array(stepSchema)

const customFieldValueSchema = z.object({
	isDefault: z.boolean(),
	value: z.string().optional(),
})

export const customFieldsSchema = z.record(z.string(), customFieldValueSchema)

export const parameterValueSchema = z.object({
	values: z.record(z.string(), z.string()),
})

export const parameterValueWithIdSchema = z.object({
	tcaseId: z.string().optional(),
	values: z.record(z.string(), z.string()),
})

export const CreateTCaseRequestSchema = z
	.object({
		title: z
			.string()
			.min(1, 'title must not be empty')
			.max(511, 'title must be at most 511 characters'),
		type: z.enum(['standalone', 'template']),
		folderId: z.number().int().positive('folderId must be a positive integer'),
		priority: z.enum(['low', 'medium', 'high']),
		comment: z.string().optional(),
		tags: z.array(z.string()).optional(),
		isDraft: z.boolean().optional(),
		steps: z.array(stepSchema).optional(),
		precondition: preconditionSchema.optional(),
		pos: z.number().int().nonnegative().optional(),
		requirements: z.array(z.object({ text: z.string(), url: z.string().max(255) })).optional(),
		links: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
		customFields: customFieldsSchema.optional(),
		parameterValues: z.array(parameterValueSchema).optional(),
		filledTCaseTitleSuffixParams: z.array(z.string()).optional(),
	})
	.superRefine((data, ctx) => {
		if (data.type !== 'template' && data.parameterValues) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['parameterValues'],
				message: 'parameterValues is only allowed for "template" test cases',
			})
		}
		if (data.type !== 'template' && data.filledTCaseTitleSuffixParams) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['filledTCaseTitleSuffixParams'],
				message: 'filledTCaseTitleSuffixParams is only allowed for "template" test cases',
			})
		}
	})

export type CreateTCaseRequest = z.infer<typeof CreateTCaseRequestSchema>

export const UpdateTCaseRequestSchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(511, 'title must be at most 511 characters')
		.optional(),
	priority: z.enum(['low', 'medium', 'high']).optional(),
	comment: z.string().optional(),
	tags: z.array(z.string()).optional(),
	isDraft: z.boolean().optional(),
	steps: z.array(stepSchema).optional(),
	precondition: preconditionSchema.optional(),
	requirements: z.array(z.object({ text: z.string(), url: z.string().max(255) })).optional(),
	links: z.array(z.object({ text: z.string(), url: z.string() })).optional(),
	customFields: customFieldsSchema.optional(),
	parameterValues: z.array(parameterValueWithIdSchema).optional(),
	filledTCaseTitleSuffixParams: z.array(z.string()).optional(),
})

export type UpdateTCaseRequest = z.infer<typeof UpdateTCaseRequestSchema>

export const createTCaseApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getPaginated: async (projectCode: ResourceId, request: GetTCasesRequest) => {
			const validated = validateRequest(request, GetTCasesRequestSchema)
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase`, validated)
			).then((r) => jsonResponse<PaginatedResponse<TCase>>(r))
		},

		getBySeq: async (projectCode: ResourceId, request: GetTCasesBySeqRequest) => {
			const validated = validateRequest(request, GetTCasesBySeqRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tcase/seq`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<PaginatedResponse<TCase>>(r))
		},

		createBatch: async (projectCode: ResourceId, request: CreateTCasesRequest) => {
			const validated = validateRequest(request, CreateTCasesBatchRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tcase/bulk`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<CreateTCasesResponse>(r))
		},

		list: async (projectCode: ResourceId, params?: ListTCasesRequest) => {
			const validated = params ? validateRequest(params, ListTCasesRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase`, validated)
			).then((r) => jsonResponse<PaginatedResponse<TCase>>(r))
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/${id}`).then((r) =>
				jsonResponse<TCase>(r)
			),

		count: async (projectCode: ResourceId, params?: CountTCasesRequest) => {
			const validated = params ? validateRequest(params, CountTCasesRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/tcase/count`, validated)
			).then((r) => jsonResponse<{ count: number }>(r))
		},

		create: async (projectCode: ResourceId, req: CreateTCaseRequest) => {
			const validated = validateRequest(req, CreateTCaseRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tcase`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ id: string; seq: number }>(r))
		},

		update: async (projectCode: ResourceId, id: ResourceId, req: UpdateTCaseRequest) => {
			const validated = validateRequest(req, UpdateTCaseRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/tcase/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ message: string }>(r))
		},
	}
}
