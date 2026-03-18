import { z } from 'zod'

export const projectLinksSchema = z.array(
	z.object({
		text: z.string().max(255, 'link text must be at most 255 characters'),
		url: z.string().url().max(255, 'link url must be at most 255 characters'),
	})
)

export const createProjectBodySchema = z.object({
	code: z
		.string()
		.min(2, '--code must be at least 2 characters')
		.max(5, '--code must be at most 5 characters')
		.regex(/^[a-zA-Z0-9]+$/, '--code must contain only alphanumeric characters'),
	title: z
		.string()
		.min(1, '--title must not be empty')
		.max(255, '--title must be at most 255 characters'),
	links: projectLinksSchema.optional(),
	overviewTitle: z.string().max(255, '--overview-title must be at most 255 characters').optional(),
	overviewDescription: z.string().optional(),
})
