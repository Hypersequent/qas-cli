import { z } from 'zod'
import { appendSearchParams, jsonResponse, withJson } from './utils'
import { validateRequest } from './schemas'

export interface AuditLog {
	id: string
	action: string
	timestamp: string
	userId: string
}

export const ListAuditLogsRequestSchema = z.object({
	after: z.string().optional(),
	count: z.number().optional(),
})

export type ListAuditLogsRequest = z.infer<typeof ListAuditLogsRequestSchema>

export interface ListAuditLogsResponse {
	after: number
	count: number
	events: AuditLog[]
}

export const createAuditLogApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (params?: ListAuditLogsRequest) => {
			const validated = params ? validateRequest(params, ListAuditLogsRequestSchema) : {}
			return fetcher(appendSearchParams(`/api/public/v0/audit-logs`, validated)).then((r) =>
				jsonResponse<ListAuditLogsResponse>(r)
			)
		},
	}
}
