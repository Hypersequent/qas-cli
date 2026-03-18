import { jsonResponse, withJson } from './utils'

export interface Status {
	id: string
	name: string
	color: string
	isActive: boolean
}

export interface UpdateStatusesRequest {
	statuses: Array<{
		id: string
		name: string
		color: string
		isActive: boolean
	}>
}

export const createSettingsApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		listStatuses: () =>
			fetcher(`/api/public/v0/settings/preferences/status`)
				.then((r) => jsonResponse<{ statuses: Status[] }>(r))
				.then((r) => r.statuses),

		updateStatuses: (req: UpdateStatusesRequest) =>
			fetcher(`/api/public/v0/settings/preferences/status`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<{ message: string }>(r)),
	}
}
