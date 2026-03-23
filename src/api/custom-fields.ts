import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface CustomField {
	id: number
	title: string
	type: string
	isActive: boolean
}

export const createCustomFieldApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		listCustomFields: (projectCode: ResourceId) =>
			fetcher(encodeURI(`/api/public/v0/project/${projectCode}/custom-field`))
				.then((r) => jsonResponse<{ customFields: CustomField[] }>(r))
				.then((r) => r.customFields),
	}
}
