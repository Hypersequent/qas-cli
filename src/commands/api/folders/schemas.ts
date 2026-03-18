import { z } from 'zod'

export const bulkCreateFoldersSchema = z.object({
	folders: z
		.array(
			z.object({
				path: z.array(z.string()).min(1, 'path must have at least one element'),
				comment: z.string().optional(),
			})
		)
		.min(1, 'Must contain at least one folder'),
})
