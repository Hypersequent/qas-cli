import { z } from 'zod'
import { jsonResponse, withJson } from './utils'
import { validateRequest } from './schemas'

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

export const CUSTOM_STATUS_IDS = ['custom1', 'custom2', 'custom3', 'custom4'] as const

export interface Status {
	id: string
	name: string
	color: string
	isActive: boolean
}

export const UpdateStatusesRequestSchema = z.object({
	statuses: z.array(
		z.object({
			id: z.enum(CUSTOM_STATUS_IDS),
			name: z.string().min(1, 'name must not be empty'),
			color: z.enum(STATUS_COLORS),
			isActive: z.boolean(),
		})
	),
})

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
