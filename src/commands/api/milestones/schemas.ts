import { z } from 'zod'

export const createMilestoneBodySchema = z.object({
	title: z
		.string()
		.min(1, '--title must not be empty')
		.max(255, '--title must be at most 255 characters'),
})
