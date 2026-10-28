import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	paginationParams,
	validateRequest,
} from './schemas'
import { integrationIssueIdSchema } from './runs'
import { appendSearchParams, jsonResponse, withJson } from './utils'

const planTitle = z
	.string()
	.min(1, 'title must not be empty')
	.max(255, 'title must be at most 255 characters')

// A plan's run has no type, and exactly one query plan that lists its test cases.
const planRunFields = {
	title: planTitle,
	assignmentId: z.number().int().positive('assignmentId must be a positive integer').optional(),
	configurationId: z.string().optional(),
}

const PlanQueryPlansSchema = z
	.array(
		z
			.object({ tcaseIds: z.array(z.string().min(1, 'test case reference must not be empty')) })
			.strict()
	)
	.length(1, 'A run of a test plan takes exactly one query plan')

export const PlanRunSchema = z.object({
	...planRunFields,
	queryPlans: PlanQueryPlansSchema,
})

// Update Test Plan takes the ids of the runs to keep (see `test-plans get`).
export const UpdatePlanRunSchema = z.object({
	id: z.number().int().positive('id must be a positive integer').optional(),
	...planRunFields,
	queryPlans: PlanQueryPlansSchema,
})

export const CreateTestPlanRequestSchema = z.object({
	title: planTitle,
	description: z.string().optional(),
	milestoneId: z.number().int().positive().optional(),
	integrationIssueId: integrationIssueIdSchema.optional(),
	runs: z.array(PlanRunSchema).min(1, 'Must contain at least one run'),
})

export type CreateTestPlanRequest = z.infer<typeof CreateTestPlanRequestSchema>

export interface CreateTestPlanResponse {
	id: number
}

export interface TestPlan {
	id: number
	title: string
	milestoneId: number | null
	closedAt: string | null
	[key: string]: unknown
}

export const ListTestPlansRequestSchema = z.object({
	...paginationParams,
	closed: z.boolean().optional(),
	milestoneIds: z.array(z.number().int().positive()).optional(),
})

export type ListTestPlansRequest = z.infer<typeof ListTestPlansRequestSchema>

export const UpdateTestPlanRequestSchema = z.object({
	title: planTitle.optional(),
	description: z.string().optional(),
	// 0 takes the plan and its runs out of their milestone.
	milestoneId: z
		.number()
		.int()
		.nonnegative('milestoneId must be a non-negative integer')
		.optional(),
	// "" removes the issue link.
	integrationIssueId: integrationIssueIdSchema.optional(),
	runs: z.array(UpdatePlanRunSchema).min(1, 'Must contain at least one run').optional(),
})

export type UpdateTestPlanRequest = z.infer<typeof UpdateTestPlanRequestSchema>

export const UpdateTestPlanRunRequestSchema = z.object({
	title: planTitle.optional(),
	// 0 unassigns the run.
	assignmentId: z
		.number()
		.int()
		.nonnegative('assignmentId must be a non-negative integer')
		.optional(),
	// "" removes the configuration.
	configurationId: z.string().optional(),
	queryPlans: PlanQueryPlansSchema.optional(),
})

export type UpdateTestPlanRunRequest = z.infer<typeof UpdateTestPlanRunRequestSchema>

export const MoveTestPlansRequestSchema = z.object({
	planIds: z
		.array(z.number().int().positive('plan IDs must be positive integers'))
		.min(1, 'Must contain at least one plan ID')
		.max(100, 'Must contain at most 100 plan IDs'),
	// 0 takes the plans out of their milestone.
	milestoneId: z.number().int().nonnegative('milestoneId must be a non-negative integer'),
})

export type MoveTestPlansRequest = z.infer<typeof MoveTestPlansRequestSchema>

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

		list: async (projectCode: ResourceId, params?: ListTestPlansRequest) => {
			const validated = params ? validateRequest(params, ListTestPlansRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/plan/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<TestPlan>>(r))
		},

		get: (projectCode: ResourceId, planId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}`).then((r) =>
				jsonResponse<TestPlan>(r)
			),

		update: async (projectCode: ResourceId, planId: ResourceId, req: UpdateTestPlanRequest) => {
			const validated = validateRequest(req, UpdateTestPlanRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<TestPlan>(r))
		},

		updateRun: async (
			projectCode: ResourceId,
			planId: ResourceId,
			runId: ResourceId,
			req: UpdateTestPlanRunRequest
		) => {
			const validated = validateRequest(req, UpdateTestPlanRunRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}/run/${runId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Record<string, unknown>>(r))
		},

		close: (projectCode: ResourceId, planId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}/close`, {
				method: 'POST',
			}).then((r) => jsonResponse<MessageResponse>(r)),

		reopen: (projectCode: ResourceId, planId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}/reopen`, {
				method: 'POST',
			}).then((r) => jsonResponse<MessageResponse>(r)),

		moveToMilestone: async (projectCode: ResourceId, req: MoveTestPlansRequest) => {
			const validated = validateRequest(req, MoveTestPlansRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/plan/milestone`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},

		delete: (projectCode: ResourceId, planId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/plan/${planId}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
