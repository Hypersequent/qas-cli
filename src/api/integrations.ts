import { z } from 'zod'
import { ResourceId, sortFieldParam, sortOrderParam, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export interface ProjectIntegration {
	id: string
	name: string
	type: 'jira' | 'github' | 'linear' | 'custom'
	config: Record<string, unknown> | null
	relationConfig: Record<string, unknown> | null
}

export interface JiraIssue {
	id: string
	key: string
	summary: string
	description: string
	url: string
}

export interface GithubIssue {
	id: number
	number: number
	title: string
	body: string
	url: string
}

export interface LinearIssue {
	id: string
	identifier: string
	title: string
	url: string
}

// Jira and Linear page their searches by cursor, so there is no offset or total.
export interface CursorPage<T> {
	data: T[]
	nextPageToken: string | null
	isLast: boolean
}

const searchText = z.string().max(255, 'search must be at most 255 characters')

// Jira counts UTF-16 code units, as z.string().max() does.
const jiraSummary = z
	.string()
	.min(1, 'summary must not be empty')
	.max(255, 'summary must be at most 255 characters')

const jiraDescription = z.string().max(32767, 'description must be at most 32767 characters')

// GitHub and Linear count characters, so an emoji counts once.
const maxChars = (max: number, field: string) =>
	z.string().refine((s) => [...s].length <= max, `${field} must be at most ${max} characters`)

export const SearchJiraIssuesRequestSchema = z.object({
	search: searchText.optional(),
	types: z.array(z.string()).optional(),
	fields: z.array(z.string()).optional(),
	limit: z
		.number()
		.int()
		.min(1, 'limit must be at least 1')
		.max(5000, 'limit must be at most 5000')
		.optional(),
	nextPageToken: z.string().optional(),
	sortField: sortFieldParam,
	sortOrder: sortOrderParam,
})

export type SearchJiraIssuesRequest = z.infer<typeof SearchJiraIssuesRequestSchema>

export const CreateJiraIssueRequestSchema = z.object({
	summary: jiraSummary,
	description: jiraDescription.optional(),
	issueTypeId: z.string().min(1, 'issueTypeId must not be empty'),
	parentId: z.string().min(1, 'parentId must not be empty').optional(),
	otherFields: z.record(z.string(), z.unknown()).optional(),
})

export type CreateJiraIssueRequest = z.infer<typeof CreateJiraIssueRequestSchema>

export interface CreateJiraIssueResponse {
	id: string
	key: string
	url: string
	attachmentUploadErrors: string[] | null
	createdAs: 'user' | 'integration'
}

// GitHub and Linear take the same create body.
export const CreateIssueRequestSchema = z.object({
	summary: maxChars(255, 'summary').refine((s) => s.length > 0, 'summary must not be empty'),
	description: maxChars(32767, 'description').optional(),
})

export type CreateIssueRequest = z.infer<typeof CreateIssueRequestSchema>

export const SearchLinearIssuesRequestSchema = z.object({
	search: searchText.optional(),
	limit: z
		.number()
		.int()
		.min(1, 'limit must be at least 1')
		.max(250, 'limit must be at most 250')
		.optional(),
	nextPageToken: z.string().optional(),
})

export type SearchLinearIssuesRequest = z.infer<typeof SearchLinearIssuesRequestSchema>

export const createIntegrationApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	const base = (projectCode: ResourceId) => `/api/public/v0/project/${projectCode}/integration`
	const tracker = (projectCode: ResourceId, type: string, integrationId: ResourceId) =>
		`${base(projectCode)}/${type}/${integrationId}`

	return {
		list: (projectCode: ResourceId) =>
			fetcher(base(projectCode)).then((r) =>
				jsonResponse<{ integrations: ProjectIntegration[] }>(r)
			),

		get: (projectCode: ResourceId, integrationId: ResourceId) =>
			fetcher(`${base(projectCode)}/${integrationId}`).then((r) =>
				jsonResponse<ProjectIntegration>(r)
			),

		jira: {
			getIssue: (projectCode: ResourceId, integrationId: ResourceId, issueId: ResourceId) =>
				fetcher(`${tracker(projectCode, 'jira', integrationId)}/issue/${issueId}`).then((r) =>
					jsonResponse<{ issue: JiraIssue }>(r)
				),

			searchIssues: async (
				projectCode: ResourceId,
				integrationId: ResourceId,
				params?: SearchJiraIssuesRequest
			) => {
				const validated = params ? validateRequest(params, SearchJiraIssuesRequestSchema) : {}
				return fetcher(
					appendSearchParams(`${tracker(projectCode, 'jira', integrationId)}/issue`, validated)
				).then((r) => jsonResponse<CursorPage<JiraIssue>>(r))
			},

			listIssueTypes: (projectCode: ResourceId, integrationId: ResourceId) =>
				fetcher(`${tracker(projectCode, 'jira', integrationId)}/issue-type`).then((r) =>
					jsonResponse<{ issueTypes: Record<string, unknown>[] }>(r)
				),

			getIssueFields: (
				projectCode: ResourceId,
				integrationId: ResourceId,
				issueTypeId: ResourceId
			) =>
				fetcher(
					`${tracker(projectCode, 'jira', integrationId)}/issue-type/${issueTypeId}/field-metadata`
				).then((r) => jsonResponse<{ fields: Record<string, unknown>[] }>(r)),

			createIssue: async (
				projectCode: ResourceId,
				integrationId: ResourceId,
				req: CreateJiraIssueRequest
			) => {
				const validated = validateRequest(req, CreateJiraIssueRequestSchema)
				return fetcher(`${tracker(projectCode, 'jira', integrationId)}/issue`, {
					method: 'POST',
					body: JSON.stringify(validated),
				}).then((r) => jsonResponse<CreateJiraIssueResponse>(r))
			},
		},

		github: {
			getIssue: (projectCode: ResourceId, integrationId: ResourceId, issueNumber: ResourceId) =>
				fetcher(`${tracker(projectCode, 'github', integrationId)}/issue/${issueNumber}`).then((r) =>
					jsonResponse<{ issue: GithubIssue }>(r)
				),

			createIssue: async (
				projectCode: ResourceId,
				integrationId: ResourceId,
				req: CreateIssueRequest
			) => {
				const validated = validateRequest(req, CreateIssueRequestSchema)
				return fetcher(`${tracker(projectCode, 'github', integrationId)}/issue`, {
					method: 'POST',
					body: JSON.stringify(validated),
				}).then((r) => jsonResponse<{ id: number; url: string }>(r))
			},
		},

		linear: {
			getIssue: (projectCode: ResourceId, integrationId: ResourceId, issueId: ResourceId) =>
				fetcher(`${tracker(projectCode, 'linear', integrationId)}/issue/${issueId}`).then((r) =>
					jsonResponse<{ issue: LinearIssue }>(r)
				),

			searchIssues: async (
				projectCode: ResourceId,
				integrationId: ResourceId,
				params?: SearchLinearIssuesRequest
			) => {
				const validated = params ? validateRequest(params, SearchLinearIssuesRequestSchema) : {}
				return fetcher(
					appendSearchParams(`${tracker(projectCode, 'linear', integrationId)}/issue`, validated)
				).then((r) => jsonResponse<CursorPage<LinearIssue>>(r))
			},

			createIssue: async (
				projectCode: ResourceId,
				integrationId: ResourceId,
				req: CreateIssueRequest
			) => {
				const validated = validateRequest(req, CreateIssueRequestSchema)
				return fetcher(`${tracker(projectCode, 'linear', integrationId)}/issue`, {
					method: 'POST',
					body: JSON.stringify(validated),
				}).then((r) => jsonResponse<{ id: string; identifier: string; url: string }>(r))
			},
		},
	}
}
