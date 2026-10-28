import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	automationResultEnum,
	filterOpEnum,
	limitParam,
	offsetParam,
	paginationParams,
	priorityEnum,
	resultStatusEnum,
	validateRequest,
} from './schemas'
import type { Folder } from './folders'
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
	folder?: Folder
}

const queryPlanFields = {
	tcaseIds: z.array(z.string()).optional(),
	folderIds: z.array(z.number().int().positive()).optional(),
	tagIds: z.array(z.number().int().positive()).optional(),
	priorities: z.array(z.enum(['low', 'medium', 'high'])).optional(),
}

type QueryPlan = z.infer<z.ZodObject<typeof queryPlanFields>>

// The API's selection rules for every run type. A filter counts once sent, even empty.
function validateSelection(plans: QueryPlan[], ctx: z.RefinementCtx) {
	plans.forEach((plan, i) => {
		const hasFilters = [plan.folderIds, plan.tagIds, plan.priorities].some((v) => v !== undefined)
		if (plan.tcaseIds !== undefined && hasFilters) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: [i, 'tcaseIds'],
				message:
					"tcaseIds can't be combined with folderIds, tagIds or priorities in a query plan, even empty ones",
			})
		}
	})
	if (plans.length > 1 && plans.some((plan) => plan.tcaseIds !== undefined)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: 'tcaseIds are only allowed in a single query plan',
		})
	}
}

// Live runs select test cases by filters only.
function rejectLiveTCaseIds(runType: string, plans: QueryPlan[], ctx: z.RefinementCtx) {
	if (runType !== 'live') return
	plans.forEach((plan, i) => {
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

export const QueryPlanSchema = z.object(queryPlanFields).strict()

// Update Run takes the id of a query plan to replace (see `runs selections`).
export const UpdateQueryPlanSchema = z
	.object({
		id: z.number().int().positive('id must be a positive integer').optional(),
		...queryPlanFields,
	})
	.strict()

export const QueryPlansSchema = z
	.array(QueryPlanSchema)
	.min(1, {
		message:
			'Must contain at least one query plan. Each plan selects test cases to include in the run. ' +
			'Example: [{"tcaseIds": ["4"]}]',
	})
	.superRefine(validateSelection)

// An issue in the project's Jira or Linear integration, by ID or key.
export const integrationIssueIdSchema = z
	.string()
	.max(255, 'integrationIssueId must be at most 255 characters')

export const CreateRunRequestSchema = z
	.object({
		title: z
			.string()
			.min(1, 'title must not be empty')
			.max(255, 'title must be at most 255 characters'),
		description: z.string().optional(),
		type: z.enum(['static', 'static_struct', 'live']),
		milestoneId: z.number().int().positive().optional(),
		configurationId: z.string().optional(),
		assignmentId: z.number().int().positive().optional(),
		integrationIssueId: integrationIssueIdSchema.optional(),
		queryPlans: QueryPlansSchema,
	})
	.superRefine((run, ctx) => rejectLiveTCaseIds(run.type, run.queryPlans, ctx))

export type CreateRunRequest = z.infer<typeof CreateRunRequestSchema>

export interface CreateRunResponse {
	id: number
}

export const ListRunsRequestSchema = z.object({
	...paginationParams,
	closed: z.boolean().optional(),
	milestoneIds: z.array(z.number().int().positive()).optional(),
	planIds: z.array(z.number().int().positive()).optional(),
	configurationIds: z.array(z.string()).optional(),
	include: z.array(z.string()).optional(),
})

export type ListRunsRequest = z.infer<typeof ListRunsRequestSchema>

export interface Run {
	id: number
	title: string
	description?: string
	type: string
	closedAt: string | null
	statusCounts?: Record<string, number>
}

export const CreateRunLogRequestSchema = z.object({
	comment: z.string().min(1, 'comment must not be empty'),
})

export type CreateRunLogRequest = z.infer<typeof CreateRunLogRequestSchema>

export const CloneRunRequestSchema = z.object({
	runId: z.number().int().positive('runId must be a positive integer'),
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	description: z.string().optional(),
	milestoneId: z.number().int().positive().optional(),
	configurationId: z.string().optional(),
	assignmentId: z.number().int().positive().optional(),
	integrationIssueId: integrationIssueIdSchema.optional(),
})

export type CloneRunRequest = z.infer<typeof CloneRunRequestSchema>

export interface CloneRunResponse {
	id: number
}

// Filters shared by a run's test case list, folder tree and status counts.
export const RunTCaseFiltersSchema = z.object({
	search: z.string().max(255, 'search must be at most 255 characters').optional(),
	tags: z.array(z.number().int().positive()).optional(),
	tagsFilterOp: filterOpEnum.optional(),
	priorities: z.array(priorityEnum).optional(),
	status: z.array(resultStatusEnum).optional(),
	automationResults: z.array(automationResultEnum).optional(),
	automationResultsFilterOp: filterOpEnum.optional(),
})

export type RunTCaseFilters = z.infer<typeof RunTCaseFiltersSchema>

export const ListRunTCasesRequestSchema = RunTCaseFiltersSchema.extend({
	...paginationParams,
	include: z.array(z.string()).optional(),
})

export type ListRunTCasesRequest = z.infer<typeof ListRunTCasesRequestSchema>

export interface RunDetails {
	id: number
	title: string
	type: string
	closedAt: string | null
	[key: string]: unknown
}

export const UpdateRunRequestSchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters')
		.optional(),
	description: z.string().optional(),
	type: z.enum(['static', 'static_struct', 'live']).optional(),
	// 0 takes the run out of its milestone, or unassigns it.
	milestoneId: z
		.number()
		.int()
		.nonnegative('milestoneId must be a non-negative integer')
		.optional(),
	assignmentId: z
		.number()
		.int()
		.nonnegative('assignmentId must be a non-negative integer')
		.optional(),
	// "" removes the configuration, or the issue link.
	configurationId: z.string().optional(),
	integrationIssueId: integrationIssueIdSchema.optional(),
	queryPlans: z
		.array(UpdateQueryPlanSchema)
		.min(1, 'Must contain at least one query plan')
		.superRefine(validateSelection)
		.optional(),
})

export type UpdateRunRequest = z.infer<typeof UpdateRunRequestSchema>

export const RunIdsSchema = z
	.array(z.number().int().positive('run IDs must be positive integers'))
	.min(1, 'Must contain at least one run ID')
	.max(100, 'Must contain at most 100 run IDs')

export const RunIdsRequestSchema = z.object({ runIds: RunIdsSchema })

export type RunIdsRequest = z.infer<typeof RunIdsRequestSchema>

export const MoveRunsRequestSchema = z.object({
	runIds: RunIdsSchema,
	// 0 takes the runs out of their milestone.
	milestoneId: z.number().int().nonnegative('milestoneId must be a non-negative integer'),
})

export type MoveRunsRequest = z.infer<typeof MoveRunsRequestSchema>

export const PreviewRunTCasesRequestSchema = z
	.object({
		runType: z.enum(['static', 'static_struct', 'live']),
		queryPlans: QueryPlansSchema,
		runId: z.number().int().positive('runId must be a positive integer').optional(),
		offset: offsetParam,
		limit: limitParam,
	})
	.superRefine((req, ctx) => rejectLiveTCaseIds(req.runType, req.queryPlans, ctx))

export type PreviewRunTCasesRequest = z.infer<typeof PreviewRunTCasesRequestSchema>

export const ListRunLogsRequestSchema = z.object(paginationParams)

export type ListRunLogsRequest = z.infer<typeof ListRunLogsRequestSchema>

export interface RunLog {
	id: string
	runId: number
	comment: string
	apiKey: { id: string; name: string } | null
	dismissed: boolean
	createdAt: string
}

export const ListAssignedRunsRequestSchema = z.object(paginationParams)

export type ListAssignedRunsRequest = z.infer<typeof ListAssignedRunsRequestSchema>

export const UpdateRunTCaseVersionRequestSchema = z.object({
	updateToLatestVersion: z.boolean().optional(),
	allowRunTCaseRemoval: z.boolean().optional(),
})

export type UpdateRunTCaseVersionRequest = z.infer<typeof UpdateRunTCaseVersionRequestSchema>

export interface UpdateRunTCaseVersionResponse {
	message: string
	removed: boolean
}

export const createRunApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)

	return {
		create: async (projectCode: ResourceId, req: CreateRunRequest) => {
			const validated = validateRequest(req, CreateRunRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<CreateRunResponse>(r))
		},

		list: async (projectCode: ResourceId, params?: ListRunsRequest) => {
			const validated = params ? validateRequest(params, ListRunsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/run/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<Run>>(r))
		},

		clone: async (projectCode: ResourceId, req: CloneRunRequest) => {
			const validated = validateRequest(req, CloneRunRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/clone`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<CloneRunResponse>(r))
		},

		close: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/close`, {
				method: 'POST',
			}).then((r) => jsonResponse<MessageResponse>(r)),

		createLog: async (projectCode: ResourceId, runId: ResourceId, req: CreateRunLogRequest) => {
			const validated = validateRequest(req, CreateRunLogRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/log`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ id: string }>(r))
		},

		listTCases: async (
			projectCode: ResourceId,
			runId: ResourceId,
			params?: ListRunTCasesRequest
		) => {
			const validated = params ? validateRequest(params, ListRunTCasesRequestSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/run/${runId}/tcase/paginated`,
					validated
				)
			).then((r) => jsonResponse<PaginatedResponse<RunTCase>>(r))
		},

		getTCase: (projectCode: ResourceId, runId: ResourceId, tcaseId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}`).then((r) =>
				jsonResponse<RunTCase>(r)
			),

		updateTCaseVersion: async (
			projectCode: ResourceId,
			runId: ResourceId,
			tcaseId: ResourceId,
			req: UpdateRunTCaseVersionRequest
		) => {
			const validated = validateRequest(req, UpdateRunTCaseVersionRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/tcase/${tcaseId}`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<UpdateRunTCaseVersionResponse>(r))
		},

		get: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}`).then((r) =>
				jsonResponse<RunDetails>(r)
			),

		update: async (projectCode: ResourceId, runId: ResourceId, req: UpdateRunRequest) => {
			const validated = validateRequest(req, UpdateRunRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/${runId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<RunDetails>(r))
		},

		reopen: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/reopen`, {
				method: 'POST',
			}).then((r) => jsonResponse<MessageResponse>(r)),

		closeMany: async (projectCode: ResourceId, req: RunIdsRequest) => {
			const validated = validateRequest(req, RunIdsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/close`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},

		reopenMany: async (projectCode: ResourceId, req: RunIdsRequest) => {
			const validated = validateRequest(req, RunIdsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/reopen`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},

		moveToMilestone: async (projectCode: ResourceId, req: MoveRunsRequest) => {
			const validated = validateRequest(req, MoveRunsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/milestone`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},

		deleteMany: async (projectCode: ResourceId, req: RunIdsRequest) => {
			const validated = validateRequest(req, RunIdsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/delete`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},

		getSelections: (projectCode: ResourceId, runId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/${runId}/selections`).then((r) =>
				jsonResponse<{ selections: Record<string, unknown>[] }>(r)
			),

		getFolderTree: async (projectCode: ResourceId, runId: ResourceId, params?: RunTCaseFilters) => {
			const validated = params ? validateRequest(params, RunTCaseFiltersSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/run/${runId}/folder/tree`,
					validated
				)
			).then((r) => jsonResponse<{ folders: Folder[] }>(r))
		},

		getStatusCounts: async (
			projectCode: ResourceId,
			runId: ResourceId,
			params?: RunTCaseFilters
		) => {
			const validated = params ? validateRequest(params, RunTCaseFiltersSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/run/${runId}/status-counts`,
					validated
				)
			).then((r) => jsonResponse<{ statusCounts: Record<string, number> }>(r))
		},

		getOpenStatusCounts: (projectCode: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/run/open-status`).then((r) =>
				jsonResponse<{ items: { runId: number; counts: Record<string, number> }[] }>(r)
			),

		previewTCases: async (projectCode: ResourceId, req: PreviewRunTCasesRequest) => {
			const validated = validateRequest(req, PreviewRunTCasesRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/run/preview-tcases`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<PaginatedResponse<RunTCase>>(r))
		},

		listAssigned: async (params?: ListAssignedRunsRequest) => {
			const validated = params ? validateRequest(params, ListAssignedRunsRequestSchema) : {}
			return fetcher(appendSearchParams(`/api/public/v0/run/assigned/paginated`, validated)).then(
				(r) => jsonResponse<PaginatedResponse<RunDetails>>(r)
			)
		},

		listLogs: async (projectCode: ResourceId, runId: ResourceId, params?: ListRunLogsRequest) => {
			const validated = params ? validateRequest(params, ListRunLogsRequestSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/run/${runId}/log/paginated`,
					validated
				)
			).then((r) => jsonResponse<PaginatedResponse<RunLog>>(r))
		},
	}
}
