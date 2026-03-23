import { z } from 'zod'

export const queryPlanSchema = z
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

export const createTestPlanBodySchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	description: z.string().optional(),
	milestoneId: z.number().int().positive().optional(),
	runs: z
		.array(
			z.object({
				title: z.string().min(1).max(255),
				description: z.string().optional(),
				type: z.enum(['static', 'static_struct', 'live']),
				configurationId: z.string().optional(),
				assignmentId: z.number().int().positive().optional(),
				queryPlans: z.array(queryPlanSchema).min(1),
			})
		)
		.min(1, 'Must contain at least one run'),
})
