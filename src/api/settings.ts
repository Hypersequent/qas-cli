import { z } from 'zod'
import { jsonResponse, withJson } from './utils'
import { validateRequest } from './schemas'

export interface Status {
	id: string
	name: string
	color: string
	isActive: boolean
}

export const UpdateStatusesRequestSchema = z.object({
	statuses: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			color: z.string(),
			isActive: z.boolean(),
		})
	),
})

export const STATUS_COLORS = [
	'blue',
	'gray',
	'red',
	'orange',
	'yellow',
	'green',
	'teal',
	'indigo',
	'purple',
	'pink',
] as const

export type UpdateStatusesRequest = z.infer<typeof UpdateStatusesRequestSchema>

export const createSettingsApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: () =>
			fetcher(`/api/public/v0/settings/preferences/status`)
				.then((r) => jsonResponse<{ statuses: Status[] }>(r))
				.then((r) => r.statuses),

		update: async (req: UpdateStatusesRequest) => {
			const validated = validateRequest(req, UpdateStatusesRequestSchema)
			return fetcher(`/api/public/v0/settings/preferences/status`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ message: string }>(r))
		},
	}
}
