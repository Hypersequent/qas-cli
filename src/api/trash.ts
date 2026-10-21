import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	limitParam,
	offsetParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export const trashResourceTypes = ['test_case', 'test_run', 'test_plan', 'milestone'] as const

export interface TrashEntry {
	id: string
	name: string
	resourceType: (typeof trashResourceTypes)[number]
	authorId: number
	author: { id: number; name: string }
	items: Array<{
		seq: number
		folderIds: number[] | null
		tcaseIds: string[] | null
		runIds: number[] | null
		planIds: number[] | null
		milestoneIds: number[] | null
	}>
	run?: { closedAt: string | null; statusCounts: Record<string, number> }
	plan?: { closedAt: string | null }
	createdAt: string
}

export const ListTrashRequestSchema = z.object({
	offset: offsetParam,
	limit: limitParam,
	sortOrder: sortOrderParam,
	resourceTypes: z.array(z.enum(trashResourceTypes)).optional(),
})

export type ListTrashRequest = z.infer<typeof ListTrashRequestSchema>

export const RestoreTrashRequestSchema = z.object({
	deleteLogIds: z
		.array(z.string().min(1, 'trash entry IDs must not be empty'))
		.min(1, 'Must contain at least one trash entry ID')
		.max(100, 'Must contain at most 100 trash entry IDs'),
})

export type RestoreTrashRequest = z.infer<typeof RestoreTrashRequestSchema>

export const createTrashApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListTrashRequest) => {
			const validated = params ? validateRequest(params, ListTrashRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/trash/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<TrashEntry>>(r))
		},

		restore: async (projectCode: ResourceId, req: RestoreTrashRequest) => {
			const validated = validateRequest(req, RestoreTrashRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/trash/restore`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},
	}
}
