import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface Project {
	id: string
	code: string
	title: string
}

export interface CreateProjectRequest {
	code: string
	title: string
	links?: Array<{ text: string; url: string }>
	overviewTitle?: string
	overviewDescription?: string
}

export const createProjectApi = (fetcher: typeof fetch) => {
	const jsonFetcher = withJson(fetcher)
	return {
		checkExists: async (project: string) => {
			const res = await fetcher(`/api/public/v0/project/${project}`)
			return res.ok
		},

		list: () =>
			jsonFetcher(`/api/public/v0/project`)
				.then((r) => jsonResponse<{ projects: Project[] | null }>(r))
				.then((r) => r.projects ?? []),

		get: (codeOrId: ResourceId) =>
			jsonFetcher(`/api/public/v0/project/${codeOrId}`).then((r) => jsonResponse<Project>(r)),

		create: (req: CreateProjectRequest) =>
			jsonFetcher(`/api/public/v0/project`, {
				method: 'POST',
				body: JSON.stringify(req),
			}).then((r) => jsonResponse<{ id: string }>(r)),
	}
}
