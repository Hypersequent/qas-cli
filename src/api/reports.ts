import { z } from 'zod'
import {
	MAX_BULK_ITEMS,
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	dateOnlySchema,
	paginationParams,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export const reportTypes = [
	'tcaseResults',
	'detailedResults',
	'traceability',
	'effort',
	'tcaseDuration',
	'tcaseSuccessRate',
	'runScorecard',
	'automationStability',
	'automatedVsManual',
	'runComparison',
	'tcaseAutomation',
] as const

export interface ReportRun {
	id: number
	title: string
	configuration: { id: string; title: string } | null
}

export interface Report {
	id: string
	seq: number
	name: string
	type: string
	projectId: string
	user: { id: number; email: string; name: string; avatar: string | null; role: string }
	createdAt: string
	updatedAt: string
	parameters: {
		startDate: string | null
		endDate: string | null
		milestones: Array<{ id: number; title: string }> | null
		runs: ReportRun[] | null
	}
	/** Absent in list responses and for tcaseAutomation reports */
	runs?: ReportRun[]
}

export const ListReportsRequestSchema = z.object({
	...paginationParams,
	reportTypes: z.array(z.string()).optional(),
	userIds: z.array(z.number().int().positive()).optional(),
	createdAfter: z.string().optional(),
	createdBefore: z.string().optional(),
})

export type ListReportsRequest = z.infer<typeof ListReportsRequestSchema>

export const reportNameSchema = z
	.string()
	.min(1, 'name must not be empty')
	.max(255, 'name must be at most 255 characters')

export const CreateReportRequestSchema = z
	.object({
		type: z.string().min(1, 'type must not be empty'),
		name: reportNameSchema,
		runIds: z.array(z.number().int().positive()).optional(),
		milestoneIds: z.array(z.number().int().positive()).optional(),
		startDate: dateOnlySchema.optional(),
		endDate: dateOnlySchema.optional(),
	})
	.refine(
		(req) =>
			[
				(req.runIds?.length ?? 0) > 0,
				(req.milestoneIds?.length ?? 0) > 0,
				req.startDate !== undefined || req.endDate !== undefined,
			].filter(Boolean).length <= 1,
		{
			message: 'A report covers runIds, milestoneIds or a period (startDate, endDate), not several',
			path: ['runIds'],
		}
	)

export type CreateReportRequest = z.infer<typeof CreateReportRequestSchema>

export const UpdateReportRequestSchema = z.object({ name: reportNameSchema })

export type UpdateReportRequest = z.infer<typeof UpdateReportRequestSchema>

export const DeleteReportsRequestSchema = z.object({
	reportIds: z
		.array(z.string().min(1, 'report reference must not be empty'))
		.min(1, 'Must contain at least one report')
		.max(MAX_BULK_ITEMS, `Must contain at most ${MAX_BULK_ITEMS} reports`),
})

export type DeleteReportsRequest = z.infer<typeof DeleteReportsRequestSchema>

export const createReportApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListReportsRequest) => {
			const validated = params ? validateRequest(params, ListReportsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/report/paginated`, validated)
			).then((r) => jsonResponse<PaginatedResponse<Report>>(r))
		},

		get: (projectCode: ResourceId, reportId: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/report/${reportId}`).then((r) =>
				jsonResponse<Report>(r)
			),

		create: async (projectCode: ResourceId, req: CreateReportRequest) => {
			const validated = validateRequest(req, CreateReportRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/report`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Report>(r))
		},

		update: async (projectCode: ResourceId, reportId: ResourceId, req: UpdateReportRequest) => {
			const validated = validateRequest(req, UpdateReportRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/report/${reportId}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Report>(r))
		},

		delete: async (projectCode: ResourceId, req: DeleteReportsRequest) => {
			const validated = validateRequest(req, DeleteReportsRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/report/delete`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<MessageResponse>(r))
		},
	}
}
