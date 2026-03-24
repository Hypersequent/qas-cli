import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface AuditLog {
	id: string
	action: string
	timestamp: string
	userId: string
}

export interface ListAuditLogsRequest {
	after?: string
	count?: number
}

export interface ListAuditLogsResponse {
	after: number
	count: number
	events: AuditLog[]
}

export const createAuditLogApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: (params?: ListAuditLogsRequest) =>
			fetcher(appendSearchParams(`/api/public/v0/audit-logs`, params ?? {})).then((r) =>
				jsonResponse<ListAuditLogsResponse>(r)
			),
	}
}
