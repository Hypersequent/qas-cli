import { z } from 'zod'
import {
	MessageResponse,
	ResourceId,
	sortFieldParam,
	sortOrderParam,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface RequirementIntegrationLink {
	type: string
	integrationId: string
	issueId: string
	issueTitle: string
	issueUrl: string
	remoteLinkId: string
}

export interface Requirement {
	id: string
	text: string
	url: string
	integrationLink?: RequirementIntegrationLink | null
	tcaseCount?: number
}

export const ListRequirementsRequestSchema = z.object({
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
	include: z.string().optional(),
})

export type ListRequirementsRequest = z.infer<typeof ListRequirementsRequestSchema>

const requirementText = z
	.string()
	.min(1, 'text must not be empty')
	.max(255, 'text must be at most 255 characters')

// "" is allowed on update, where it clears the URL
const requirementUrl = z.union([
	z.literal(''),
	z.string().url('url must be a valid URL').max(255, 'url must be at most 255 characters'),
])

const integrationIssueId = z.string().max(255, 'integrationIssueId must be at most 255 characters')

export const CreateRequirementRequestSchema = z.object({
	text: requirementText,
	url: requirementUrl.optional(),
	integrationIssueId: integrationIssueId.optional(),
})

export type CreateRequirementRequest = z.infer<typeof CreateRequirementRequestSchema>

export const UpdateRequirementRequestSchema = z.object({
	text: requirementText.optional(),
	url: requirementUrl.optional(),
	integrationIssueId: integrationIssueId.optional(),
})

export type UpdateRequirementRequest = z.infer<typeof UpdateRequirementRequestSchema>

export const createRequirementApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListRequirementsRequest) => {
			const validated = params ? validateRequest(params, ListRequirementsRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/requirement`, validated)
			)
				.then((r) => jsonResponse<{ requirements: Requirement[] }>(r))
				.then((r) => r.requirements)
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/requirement/${id}`).then((r) =>
				jsonResponse<Requirement>(r)
			),

		create: async (projectCode: ResourceId, req: CreateRequirementRequest) => {
			const validated = validateRequest(req, CreateRequirementRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/requirement`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Requirement>(r))
		},

		update: async (projectCode: ResourceId, id: ResourceId, req: UpdateRequirementRequest) => {
			const validated = validateRequest(req, UpdateRequirementRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/requirement/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Requirement>(r))
		},

		delete: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/requirement/${id}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
