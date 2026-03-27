import { z } from 'zod'
import { appendSearchParams, jsonResponse, withJson } from './utils'
import { validateRequest } from './schemas'

export interface AuditLogUser {
	id: number
	name: string
	email: string
}

export interface AuditLog {
	id: number
	user: AuditLogUser | null
	action: string
	ip: string
	userAgent: string
	createdAt: string
	meta?: Record<string, unknown>
}

export const ListAuditLogsRequestSchema = z.object({
	after: z.number().int().nonnegative().optional(),
	count: z.number().int().positive().optional(),
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
