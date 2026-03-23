import { z } from 'zod'
import { queryPlanSchema } from '../test-plans/schemas'

export const queryPlansSchema = z.array(queryPlanSchema).min(1, {
	message:
		'Must contain at least one query plan. Each plan selects test cases to include in the run. ' +
		'Example: [{"tcaseIds": ["abc123"]}]',
})

export const createRunBodySchema = z
	.object({
		title: z
			.string()
			.min(1, '--title must not be empty')
			.max(255, '--title must be at most 255 characters'),
		description: z.string().max(512, '--description must be at most 512 characters').optional(),
		type: z.enum(['static', 'static_struct', 'live']),
		milestoneId: z.number().int().positive().optional(),
		configurationId: z.string().optional(),
		assignmentId: z.number().int().positive().optional(),
		queryPlans: queryPlansSchema,
	})
	.superRefine((body, ctx) => {
		if (body.type !== 'live' && body.queryPlans.length > 1) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['queryPlans'],
				message: `Run type "${body.type}" supports exactly one query plan, but ${body.queryPlans.length} were provided. Only "live" runs support multiple query plans.`,
			})
		}
		if (body.type === 'live') {
			body.queryPlans.forEach((plan, i) => {
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
	})

export const cloneRunBodySchema = z.object({
	runId: z.number().int().positive('--run-id must be a positive integer'),
	title: z
		.string()
		.min(1, '--title must not be empty')
		.max(255, '--title must be at most 255 characters'),
	description: z.string().max(512, '--description must be at most 512 characters').optional(),
	milestoneId: z.number().int().positive().optional(),
	assignmentId: z.number().int().positive().optional(),
})
