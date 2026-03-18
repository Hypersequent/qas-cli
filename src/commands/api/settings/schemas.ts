import { z } from 'zod'

const statusItemSchema = z.object({
	id: z.enum(['custom1', 'custom2', 'custom3', 'custom4']),
	name: z.string().min(1, 'name must not be empty'),
	color: z.string(),
	isActive: z.boolean(),
})

export const updateStatusesInputSchema = z
	.array(statusItemSchema)
	.min(1, 'Must contain at least one status')
