import { z } from 'zod'

const preconditionSchema = z.union([
	z.object({ text: z.string() }),
	z.object({ sharedPreconditionId: z.number().int().positive() }),
])

const stepSchema = z.object({
	description: z.string(),
	expected: z.string().optional(),
	sharedStepId: z.number().int().positive().optional(),
})

export const stepsArraySchema = z.array(stepSchema)

export const createTCaseBodySchema = z.object({
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
})

export const updateTCaseBodySchema = z.object({
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
})
