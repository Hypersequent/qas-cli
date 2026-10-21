import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface ProjectLink {
	text: string
	url: string
}

export const userRoles = ['owner', 'admin', 'user', 'test-runner', 'viewer'] as const

export interface ProjectUser {
	id: number
	email: string
	name: string
	avatar: string | null
	role: (typeof userRoles)[number]
}

export interface ProjectTeamMember {
	role: string
	user: ProjectUser
}

export interface Project {
	id: string
	code: string
	title: string
	description: string
	overviewTitle: string
	overviewDescription: string
	links: ProjectLink[]
	createdAt: string
	updatedAt: string
	archivedAt: string | null
	/** Only returned for a single project (get and update). */
	teamMembers?: ProjectTeamMember[]
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

export const projectTeamMembersSchema = z.array(
	z.object({
		userId: z.number().int().positive('userId must be a positive integer'),
		role: z
			.string()
			.min(1, 'role must not be empty')
			.max(255, 'role must be at most 255 characters'),
		pos: z.number().int().nonnegative().optional(),
	})
)

export const UpdateProjectRequestSchema = z.object({
	title: CreateProjectRequestSchema.shape.title.optional(),
	archived: z.boolean().optional(),
	links: projectLinksSchema.optional(),
	overviewTitle: CreateProjectRequestSchema.shape.overviewTitle,
	overviewDescription: CreateProjectRequestSchema.shape.overviewDescription,
	teamMembers: projectTeamMembersSchema.optional(),
})

export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequestSchema>

export const ListProjectUsersRequestSchema = z.object({
	roles: z.array(z.enum(userRoles)).optional(),
})

export type ListProjectUsersRequest = z.infer<typeof ListProjectUsersRequestSchema>

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

		update: async (codeOrId: ResourceId, req: UpdateProjectRequest) => {
			const validated = validateRequest(req, UpdateProjectRequestSchema)
			// The team card orders by pos, so an omitted pos follows the list order
			const teamMembers = validated.teamMembers?.map((member, i) => ({
				...member,
				pos: member.pos ?? i,
			}))
			return jsonFetcher(`/api/public/v0/project/${codeOrId}`, {
				method: 'PATCH',
				body: JSON.stringify({ ...validated, teamMembers }),
			}).then((r) => jsonResponse<Project>(r))
		},

		listUsers: async (codeOrId: ResourceId, params?: ListProjectUsersRequest) => {
			const validated = params ? validateRequest(params, ListProjectUsersRequestSchema) : {}
			return jsonFetcher(
				appendSearchParams(`/api/public/v0/project/${codeOrId}/users`, validated)
			).then((r) => jsonResponse<{ users: ProjectUser[] }>(r))
		},
	}
}
