import { z } from 'zod'
import {
	MessageResponse,
	ResourceId,
	limitParam,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
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

export const QueryPlanSchema = z
	.object({
		tcaseIds: z.array(z.string()).optional(),
		folderIds: z.array(z.number().int().positive()).optional(),
		tagIds: z.array(z.number().int().positive()).optional(),
		priorities: z.array(z.enum(['low', 'medium', 'high'])).optional(),
	})
	.strict()
	.refine((plan) => Object.values(plan).some((v) => v !== undefined), {
		message:
			'Each query plan must specify at least one filter (tcaseIds, folderIds, tagIds, or priorities)',
	})

export const QueryPlansSchema = z.array(QueryPlanSchema).min(1, {
	message:
		'Must contain at least one query plan. Each plan selects test cases to include in the run. ' +
		'Example: [{"tcaseIds": ["abc123"]}]',
})

function validateQueryPlans(
	run: { type: string; queryPlans: z.infer<typeof QueryPlanSchema>[] },
	ctx: z.RefinementCtx
) {
	if (run.type !== 'live' && run.queryPlans.length > 1) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['queryPlans'],
			message: `Run type "${run.type}" supports exactly one query plan, but ${run.queryPlans.length} were provided. Only "live" runs support multiple query plans.`,
		})
	}
	if (run.type === 'live') {
		run.queryPlans.forEach((plan, i) => {
			if (plan.tcaseIds !== undefined) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['queryPlans', i, 'tcaseIds'],
					message:
						'tcaseIds is not allowed for "live" runs. Live runs only support filter-based selection (folderIds, tagIds, priorities).',
				})
			}
		})
	}
}

export const CreateRunRequestSchema = z
	.object({
		title: z
			.string()
			.min(1, 'title must not be empty')
			.max(255, 'title must be at most 255 characters'),
		description: z.string().max(512, 'description must be at most 512 characters').optional(),
		type: z.enum(['static', 'static_struct', 'live']),
		milestoneId: z.number().int().positive().optional(),
		configurationId: z.string().optional(),
		assignmentId: z.number().int().positive().optional(),
		queryPlans: QueryPlansSchema,
	})
	.superRefine(validateQueryPlans)

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>

export interface CreateRunResponse {
	id: number
}

export const ListRunsRequestSchema = z.object({
	closed: z.boolean().optional(),
	milestoneIds: z.array(z.number()).optional(),
	limit: limitParam,
})

export type ListRunsRequest = z.infer<typeof ListRunsRequestSchema>

export interface Run {
	id: number
	title: string
	description?: string
	type: string
	closed: boolean
}

export const CreateRunLogRequestSchema = z.object({
	comment: z.string(),
})

export type CreateRunLogRequest = z.infer<typeof CreateRunLogRequestSchema>

export const CloneRunRequestSchema = z.object({
	runId: z.number().int().positive('runId must be a positive integer'),
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	description: z.string().max(512, 'description must be at most 512 characters').optional(),
	milestoneId: z.number().int().positive().optional(),
	assignmentId: z.number().int().positive().optional(),
})

export type CloneRunRequest = z.infer<typeof CloneRunRequestSchema>

export interface CloneRunResponse {
	id: number
}

export const ListRunTCasesRequestSchema = z.object({
	search: z.string().optional(),
	tags: z.array(z.number()).optional(),
	priorities: z.array(z.string()).optional(),
	limit: limitParam,
	include: z.string().optional(),
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
})

export type ListRunTCasesRequest = z.infer<typeof ListRunTCasesRequestSchema>

export const RunSchema = z
	.object({
		title: z.string().min(1).max(255),
		description: z.string().optional(),
		type: z.enum(['static', 'static_struct', 'live']),
		configurationId: z.string().optional(),
		assignmentId: z.number().int().positive().optional(),
		queryPlans: z.array(QueryPlanSchema).min(1),
	})
	.superRefine(validateQueryPlans)

export const createRunApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)

	const getTCases = (projectCode: ResourceId, runId: ResourceId) =>
		fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase`)
			.then((r) => jsonResponse<{ tcases: RunTCase[] }>(r))
			.then((r) => r.tcases)

	const create = async (projectCode: ResourceId, req: CreateRunRequest) => {
		const validated = validateRequest(req, CreateRunRequestSchema)
		return fetcher(`/api/public/v0/project/${projectCode}/run`, {
			method: 'POST',
			body: JSON.stringify(validated),
		}).then((r) => jsonResponse<CreateRunResponse>(r))
	}

	const list = async (projectCode: ResourceId, params?: ListRunsRequest) => {
		const validated = params ? validateRequest(params, ListRunsRequestSchema) : {}
		return fetcher(appendSearchParams(`/api/public/v0/project/${projectCode}/run`, validated))
			.then((r) => jsonResponse<{ runs: Run[] }>(r))
			.then((r) => r.runs)
	}

	const clone = async (projectCode: ResourceId, req: CloneRunRequest) => {
		const validated = validateRequest(req, CloneRunRequestSchema)
		return fetcher(`/api/public/v0/project/${projectCode}/run/clone`, {
			method: 'POST',
			body: JSON.stringify(validated),
		}).then((r) => jsonResponse<CloneRunResponse>(r))
	}

	const close = (projectCode: ResourceId, runId: ResourceId) =>
		fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/close`, {
			method: 'POST',
		}).then((r) => jsonResponse<MessageResponse>(r))

	const createLog = async (projectCode: ResourceId, runId: ResourceId, req: CreateRunLogRequest) => {
		const validated = validateRequest(req, CreateRunLogRequestSchema)
		return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/log`, {
			method: 'POST',
			body: JSON.stringify(validated),
		}).then((r) => jsonResponse<{ id: string }>(r))
	}

	const listTCases = async (
		projectCode: ResourceId,
		runId: ResourceId,
		params?: ListRunTCasesRequest
	) => {
		const validated = params ? validateRequest(params, ListRunTCasesRequestSchema) : {}
		return fetcher(
			appendSearchParams(`/api/public/v0/project/${projectCode}/run/${runId}/tcase`, validated)
		)
			.then((r) => jsonResponse<{ tcases: RunTCase[] }>(r))
			.then((r) => r.tcases)
	}

	const getTCase = (projectCode: ResourceId, runId: ResourceId, tcaseId: ResourceId) =>
		fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}`).then((r) =>
			jsonResponse<RunTCase>(r)
		)

	return {
		getTCases,
		create,
		list,
		clone,
		close,
		createLog,
		listTCases,
		getTCase,
		getRunTCases: getTCases,
		createRun: create,
		listRuns: list,
		cloneRun: clone,
		closeRun: close,
		createRunLog: createLog,
		listRunTCases: listTCases,
		getRunTCase: getTCase,
	}
}
