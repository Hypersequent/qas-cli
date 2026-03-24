import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface Project {
	id: string
	code: string
	title: string
}

export const projectLinksSchema = z.array(
	z.object({
		text: z.string().max(255, 'link text must be at most 255 characters'),
		url: z.string().url().max(255, 'link url must be at most 255 characters'),
	})
)

export const CreateProjectRequestSchema = z.object({
	code: z
		.string()
		.min(2, 'code must be at least 2 characters')
		.max(5, 'code must be at most 5 characters')
		.regex(/^[a-zA-Z0-9]+$/, 'code must contain only alphanumeric characters'),
	title: z
		.string()
		.min(1, 'title must not be empty')
		.max(255, 'title must be at most 255 characters'),
	links: projectLinksSchema.optional(),
	overviewTitle: z.string().max(255, 'overviewTitle must be at most 255 characters').optional(),
	overviewDescription: z.string().optional(),
})

export type CreateProjectRequest = z.infer<typeof CreateProjectRequestSchema>

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

		create: async (req: CreateProjectRequest) => {
			const validated = validateRequest(req, CreateProjectRequestSchema)
			return jsonFetcher(`/api/public/v0/project`, {
				method: 'POST',
				body: JSON.stringify(validated),
			}).then((r) => jsonResponse<{ id: string }>(r))
		},
	}
}
