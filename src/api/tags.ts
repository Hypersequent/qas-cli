import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface Tag {
	id: number
	title: string
}

export const createTagApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		listTags: (projectCode: ResourceId) =>
			fetcher(`/api/public/v0/project/${projectCode}/tag`)
				.then((r) => jsonResponse<{ tags: Tag[] }>(r))
				.then((r) => r.tags),
	}
}
