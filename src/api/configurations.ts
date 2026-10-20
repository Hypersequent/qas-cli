import { z } from 'zod'
import {
	MessageResponse,
	PaginatedResponse,
	ResourceId,
	paginationParams,
	validateRequest,
} from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface Configuration {
	id: string
	title: string
	runCount?: number
	createdAt: string
	updatedAt: string
}

export const ListConfigurationsRequestSchema = z.object({
	...paginationParams,
	include: z.array(z.string()).optional(),
})

export type ListConfigurationsRequest = z.infer<typeof ListConfigurationsRequestSchema>

export const configurationTitleSchema = z
	.string()
	.min(1, 'title must not be empty')
	.max(64, 'title must be at most 64 characters')

export const ConfigurationRequestSchema = z.object({ title: configurationTitleSchema })

export type ConfigurationRequest = z.infer<typeof ConfigurationRequestSchema>

export const createConfigurationApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListConfigurationsRequest) => {
			const validated = params ? validateRequest(params, ListConfigurationsRequestSchema) : {}
			return fetcher(
				appendSearchParams(
					`/api/public/v0/project/${projectCode}/configuration/paginated`,
					validated
				)
			).then((r) => jsonResponse<PaginatedResponse<Configuration>>(r))
		},

		get: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/configuration/${id}`).then((r) =>
				jsonResponse<Configuration>(r)
			),

		create: async (projectCode: ResourceId, req: ConfigurationRequest) => {
			const validated = validateRequest(req, ConfigurationRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/configuration`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Configuration>(r))
		},

		update: async (projectCode: ResourceId, id: ResourceId, req: ConfigurationRequest) => {
			const validated = validateRequest(req, ConfigurationRequestSchema)
			return fetcher(`/api/public/v0/project/${projectCode}/configuration/${id}`, {
				method: 'PATCH',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<Configuration>(r))
		},

		delete: (projectCode: ResourceId, id: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/configuration/${id}`, {
				method: 'DELETE',
			}).then((r) => jsonResponse<MessageResponse>(r)),
	}
}
