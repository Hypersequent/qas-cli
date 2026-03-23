import { z } from 'zod'
import { runSchema } from '../runs/schemas'

export const createTestPlanBodySchema = z.object({
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	description: z.string().optional(),
	milestoneId: z.number().int().positive().optional(),
	runs: z.array(runSchema).min(1, 'Must contain at least one run'),
})
