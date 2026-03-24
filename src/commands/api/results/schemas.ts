import { z } from 'zod'
import { CreateResultsRequestSchema } from '../../../api/results'

/**
 * Accepts either `{ items: [...] }` or a bare array of result items.
 * A bare array is automatically wrapped into the `{ items }` shape.
 */
export const batchCreateResultsInputSchema = z
	.unknown()
	.transform((val) => (Array.isArray(val) ? { items: val } : val))
	.pipe(CreateResultsRequestSchema)
