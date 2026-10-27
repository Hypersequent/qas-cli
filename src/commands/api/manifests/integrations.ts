import { z } from 'zod'
import {
	CreateIssueRequestSchema,
	CreateJiraIssueRequestSchema,
	type CreateIssueRequest,
	type CreateJiraIssueRequest,
	type SearchJiraIssuesRequest,
	type SearchLinearIssuesRequest,
} from '../../../api/integrations'
import { resourceIdSchema, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import { intIdParam, projectCodeParam, requireFieldsOrBody, splitList } from './utils'
import type { ApiEndpointSpec, ApiFieldSpec, ApiPathParamSpec } from '../types'

const help = {
	'integration-id': 'Integration ID (see integrations list).',
	'jira-issue-id': 'Jira issue ID or key (e.g., "QA-12").',
	'github-issue-number': 'Issue number in the linked GitHub repository.',
	'linear-issue-id': 'Linear issue ID or identifier (e.g., "ENG-34").',
	'jira-issue-type-id': 'Jira issue type ID (see integrations jira issue-types list).',
	'linear-search':
		'Text in issue titles or descriptions, or an issue identifier (max 255 characters).',
	'jira-search':
		'Words the issue titles start with, or an issue key or number (max 255 characters).',
	'jira-types': 'Comma-separated Jira issue type names to filter by (e.g., "Bug,Story").',
	'jira-fields':
		'Comma-separated Jira fields to return, such as "summary,description". Defaults to the summary.',
	'jira-limit': 'Maximum number of issues to return (1-5000, defaults to 20).',
	'linear-limit': 'Maximum number of issues to return (1-250, defaults to 20).',
	'next-page-token':
		'The nextPageToken of the previous page. Searches page by cursor: repeat until isLast is true.',
	'jira-sort-field': 'Field to sort by; created by default.',
	'jira-sort-order':
		'Sort direction (asc or desc). Without --sort-field, the newest issues come first.',
	summary: 'Issue title, 1-255 characters.',
	'jira-description': "Issue description in Jira's text format (max 32,767 characters).",
	description: 'Issue description in Markdown (max 32,767 characters).',
	'jira-parent-id': 'ID of the parent issue, which sub-task types need.',
	'jira-other-fields': `JSON object of other Jira fields by key, in Jira's REST API format (see integrations jira issue-types fields). It can't set summary, description, issuetype, parent, project or reporter.\nExample: '{"priority": {"name": "High"}}'`,
	list: {
		describe:
			"List a project's integrations: their type, settings (no credentials) and project link.",
		epilog: apiDocsEpilog('integrations', 'list-integrations'),
		examples: [
			{
				usage: '$0 api integrations list --project-code PRJ',
				description: "List a project's integrations",
			},
		],
	},
	get: {
		describe: 'Get an integration linked to a project.',
		epilog: apiDocsEpilog('integrations', 'get-integration'),
		examples: [
			{
				usage:
					'$0 api integrations get --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F',
				description: 'Get an integration',
			},
		],
	},
	jiraGet: {
		describe: 'Get an issue of the linked Jira project, by its ID or key.',
		epilog: apiDocsEpilog('integrations', 'get-jira-issue'),
		examples: [
			{
				usage:
					'$0 api integrations jira issues get --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --issue-id QA-12',
				description: 'Get a Jira issue',
			},
		],
	},
	jiraSearch: {
		describe: 'Search the issues of the linked Jira project.',
		epilog: apiDocsEpilog('integrations', 'search-jira-issues'),
		examples: [
			{
				usage:
					'$0 api integrations jira issues search --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --search login',
				description: 'Search Jira issues',
			},
		],
	},
	jiraCreate: {
		describe:
			"Create an issue in the linked Jira project, under your own Jira account if you have connected it to QA Sphere, otherwise under the integration's account. Link it to a result with results update --create-links.",
		epilog: apiDocsEpilog('integrations', 'create-jira-issue'),
		examples: [
			{
				usage:
					'$0 api integrations jira issues create --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --summary "Login fails" --issue-type-id 10001',
				description: 'Create a Jira issue',
			},
		],
	},
	jiraIssueTypes: {
		describe: 'List the issue types of the linked Jira project.',
		epilog: apiDocsEpilog('integrations', 'list-jira-issue-types'),
		examples: [
			{
				usage:
					'$0 api integrations jira issue-types list --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F',
				description: 'List Jira issue types',
			},
		],
	},
	jiraIssueFields: {
		describe:
			'List the fields a Jira issue type takes. Required ones other than summary, description, issue type and parent go in --other-fields of integrations jira issues create; QA Sphere sets project and reporter itself.',
		epilog: apiDocsEpilog('integrations', 'get-jira-issue-fields'),
		examples: [
			{
				usage:
					'$0 api integrations jira issue-types fields --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --issue-type-id 10001',
				description: 'List the fields of a Jira issue type',
			},
		],
	},
	githubGet: {
		describe: 'Get an issue of the linked GitHub repository, by its number.',
		epilog: apiDocsEpilog('integrations', 'get-github-issue'),
		examples: [
			{
				usage:
					'$0 api integrations github issues get --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --issue-number 12',
				description: 'Get a GitHub issue',
			},
		],
	},
	githubCreate: {
		describe:
			"Create an issue in the linked GitHub repository, as the integration's GitHub App. Link it to a result with results update --create-links.",
		epilog: apiDocsEpilog('integrations', 'create-github-issue'),
		examples: [
			{
				usage:
					'$0 api integrations github issues create --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --summary "Login fails"',
				description: 'Create a GitHub issue',
			},
		],
	},
	linearGet: {
		describe: 'Get an issue of the linked Linear team, by its ID or identifier.',
		epilog: apiDocsEpilog('integrations', 'get-linear-issue'),
		examples: [
			{
				usage:
					'$0 api integrations linear issues get --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --issue-id ENG-34',
				description: 'Get a Linear issue',
			},
		],
	},
	linearSearch: {
		describe: 'Search the issues of the linked Linear team.',
		epilog: apiDocsEpilog('integrations', 'search-linear-issues'),
		examples: [
			{
				usage:
					'$0 api integrations linear issues search --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --search login',
				description: 'Search Linear issues',
			},
		],
	},
	linearCreate: {
		describe:
			"Create an issue in the linked Linear team, as the integration's Linear account. Link it to a result with results update --create-links.",
		epilog: apiDocsEpilog('integrations', 'create-linear-issue'),
		examples: [
			{
				usage:
					'$0 api integrations linear issues create --project-code PRJ --integration-id 1CSWAh3ys_YniqfXepnwT8F --summary "Login fails"',
				description: 'Create a Linear issue',
			},
		],
	},
} as const

const resourceParam = (name: string, describe: string): ApiPathParamSpec => ({
	name,
	type: 'string',
	describe,
	schema: resourceIdSchema,
})

const integrationIdParam = resourceParam('integration-id', help['integration-id'])

const summaryField: ApiFieldSpec = {
	name: 'summary',
	type: 'string',
	describe: help.summary,
	schema: CreateIssueRequestSchema.shape.summary,
}

// GitHub and Linear take the same create body.
const createIssueSpec = (
	tracker: 'github' | 'linear',
	text: { describe: string; epilog: string; examples: ApiEndpointSpec['examples'] }
): ApiEndpointSpec => ({
	id: `integrations.${tracker}.issues.create`,
	commandPath: ['integrations', tracker, 'issues', 'create'],
	describe: text.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, integrationIdParam],
	fieldOptions: [
		summaryField,
		{
			name: 'description',
			type: 'string',
			describe: help.description,
			schema: CreateIssueRequestSchema.shape.description.unwrap(),
		},
	],
	check: requireFieldsOrBody('summary'),
	epilog: text.epilog,
	examples: text.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.integrations[tracker].createIssue(
				pathParams['project-code'],
				pathParams['integration-id'],
				body as CreateIssueRequest
			)
		)
	},
})

const list: ApiEndpointSpec = {
	id: 'integrations.list',
	commandPath: ['integrations', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.integrations.list(pathParams['project-code']))
	},
}

const get: ApiEndpointSpec = {
	id: 'integrations.get',
	commandPath: ['integrations', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, integrationIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.integrations.get(pathParams['project-code'], pathParams['integration-id']))
	},
}

const jiraSearch: ApiEndpointSpec = {
	id: 'integrations.jira.issues.search',
	commandPath: ['integrations', 'jira', 'issues', 'search'],
	describe: help.jiraSearch.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, integrationIdParam],
	queryOptions: [
		{ name: 'search', type: 'string', describe: help['jira-search'] },
		{ name: 'types', type: 'string', describe: help['jira-types'] },
		{ name: 'fields', type: 'string', describe: help['jira-fields'] },
		{ name: 'limit', type: 'number', describe: help['jira-limit'] },
		{ name: 'next-page-token', type: 'string', describe: help['next-page-token'] },
		{
			name: 'sort-field',
			type: 'string',
			describe: help['jira-sort-field'],
			helpChoices: ['created', 'updated', 'priority', 'status', 'key', 'summary', 'issuetype'],
		},
		{
			name: 'sort-order',
			type: 'string',
			describe: help['jira-sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		types: splitList(query.types),
		fields: splitList(query.fields),
	}),
	epilog: help.jiraSearch.epilog,
	examples: help.jiraSearch.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.integrations.jira.searchIssues(
				pathParams['project-code'],
				pathParams['integration-id'],
				query as SearchJiraIssuesRequest
			)
		)
	},
}

const jiraGet: ApiEndpointSpec = {
	id: 'integrations.jira.issues.get',
	commandPath: ['integrations', 'jira', 'issues', 'get'],
	describe: help.jiraGet.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		integrationIdParam,
		resourceParam('issue-id', help['jira-issue-id']),
	],
	epilog: help.jiraGet.epilog,
	examples: help.jiraGet.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.integrations.jira.getIssue(
				pathParams['project-code'],
				pathParams['integration-id'],
				pathParams['issue-id']
			)
		)
	},
}

const jiraCreate: ApiEndpointSpec = {
	id: 'integrations.jira.issues.create',
	commandPath: ['integrations', 'jira', 'issues', 'create'],
	describe: help.jiraCreate.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, integrationIdParam],
	fieldOptions: [
		summaryField,
		{
			name: 'description',
			type: 'string',
			describe: help['jira-description'],
			schema: CreateJiraIssueRequestSchema.shape.description.unwrap(),
		},
		{
			name: 'issue-type-id',
			type: 'string',
			describe: help['jira-issue-type-id'],
			schema: CreateJiraIssueRequestSchema.shape.issueTypeId,
		},
		{
			name: 'parent-id',
			type: 'string',
			describe: help['jira-parent-id'],
			schema: CreateJiraIssueRequestSchema.shape.parentId.unwrap(),
		},
		{
			name: 'other-fields',
			type: 'string',
			describe: help['jira-other-fields'],
			schema: z.record(z.string(), z.unknown()),
			jsonParse: true,
		},
	],
	check: requireFieldsOrBody('summary', 'issue-type-id'),
	epilog: help.jiraCreate.epilog,
	examples: help.jiraCreate.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.integrations.jira.createIssue(
				pathParams['project-code'],
				pathParams['integration-id'],
				body as CreateJiraIssueRequest
			)
		)
	},
}

const jiraIssueTypes: ApiEndpointSpec = {
	id: 'integrations.jira.issue-types.list',
	commandPath: ['integrations', 'jira', 'issue-types', 'list'],
	describe: help.jiraIssueTypes.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, integrationIdParam],
	epilog: help.jiraIssueTypes.epilog,
	examples: help.jiraIssueTypes.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.integrations.jira.listIssueTypes(
				pathParams['project-code'],
				pathParams['integration-id']
			)
		)
	},
}

const jiraIssueFields: ApiEndpointSpec = {
	id: 'integrations.jira.issue-types.fields',
	commandPath: ['integrations', 'jira', 'issue-types', 'fields'],
	describe: help.jiraIssueFields.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		integrationIdParam,
		intIdParam('issue-type-id', help['jira-issue-type-id']),
	],
	epilog: help.jiraIssueFields.epilog,
	examples: help.jiraIssueFields.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.integrations.jira.getIssueFields(
				pathParams['project-code'],
				pathParams['integration-id'],
				pathParams['issue-type-id']
			)
		)
	},
}

const githubGet: ApiEndpointSpec = {
	id: 'integrations.github.issues.get',
	commandPath: ['integrations', 'github', 'issues', 'get'],
	describe: help.githubGet.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		integrationIdParam,
		intIdParam('issue-number', help['github-issue-number']),
	],
	epilog: help.githubGet.epilog,
	examples: help.githubGet.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.integrations.github.getIssue(
				pathParams['project-code'],
				pathParams['integration-id'],
				pathParams['issue-number']
			)
		)
	},
}

const linearSearch: ApiEndpointSpec = {
	id: 'integrations.linear.issues.search',
	commandPath: ['integrations', 'linear', 'issues', 'search'],
	describe: help.linearSearch.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, integrationIdParam],
	queryOptions: [
		{ name: 'search', type: 'string', describe: help['linear-search'] },
		{ name: 'limit', type: 'number', describe: help['linear-limit'] },
		{ name: 'next-page-token', type: 'string', describe: help['next-page-token'] },
	],
	transformQuery: (query) => kebabToCamelCaseKeys(query),
	epilog: help.linearSearch.epilog,
	examples: help.linearSearch.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.integrations.linear.searchIssues(
				pathParams['project-code'],
				pathParams['integration-id'],
				query as SearchLinearIssuesRequest
			)
		)
	},
}

const linearGet: ApiEndpointSpec = {
	id: 'integrations.linear.issues.get',
	commandPath: ['integrations', 'linear', 'issues', 'get'],
	describe: help.linearGet.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		integrationIdParam,
		resourceParam('issue-id', help['linear-issue-id']),
	],
	epilog: help.linearGet.epilog,
	examples: help.linearGet.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.integrations.linear.getIssue(
				pathParams['project-code'],
				pathParams['integration-id'],
				pathParams['issue-id']
			)
		)
	},
}

export const integrationSpecs: ApiEndpointSpec[] = [
	list,
	get,
	jiraSearch,
	jiraGet,
	jiraCreate,
	jiraIssueTypes,
	jiraIssueFields,
	githubGet,
	createIssueSpec('github', help.githubCreate),
	linearSearch,
	linearGet,
	createIssueSpec('linear', help.linearCreate),
]
