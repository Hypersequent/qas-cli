import { z } from 'zod'

const resultStatusEnum = z.enum([
	'passed',
	'failed',
	'blocked',
	'skipped',
	'open',
	'custom1',
	'custom2',
	'custom3',
	'custom4',
])

export const resultLinksSchema = z.array(
	z.object({
		text: z.string(),
		url: z.string().url(),
	})
)

export const createResultBodySchema = z.object({
	status: resultStatusEnum,
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative().nullable().optional(),
	links: resultLinksSchema.optional(),
})

const batchCreateResultBodyItemSchema = z.object({
	tcaseId: z.string(),
	status: resultStatusEnum,
	comment: z.string().optional(),
	timeTaken: z.number().int().nonnegative().nullable().optional(),
	links: resultLinksSchema.optional(),
})

export { batchCreateResultBodyItemSchema }

export const batchCreateResultsBodySchema = z.object({
	items: z.array(batchCreateResultBodyItemSchema).min(1, 'Must contain at least one result item'),
})

/**
 * Accepts either `{ items: [...] }` or a bare array of result items.
 * A bare array is automatically wrapped into the `{ items }` shape.
 */
export const batchCreateResultsInputSchema = z
	.unknown()
	.transform((val) => (Array.isArray(val) ? { items: val } : val))
	.pipe(batchCreateResultsBodySchema)
