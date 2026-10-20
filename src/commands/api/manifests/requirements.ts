import {
	CreateRequirementRequestSchema,
	UpdateRequirementRequestSchema,
} from '../../../api/requirements'
import { resourceIdSchema, sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec, ApiPathParamSpec } from '../types'

const help = {
	...commonHelp,
	include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
	'requirement-id': 'Requirement ID.',
	text: 'Requirement text, 1-255 characters, unique in the project.',
	url: 'URL of the requirement (an HTTP or HTTPS URL, max 255 characters).',
	'integration-issue-id':
		"ID or key of an issue in the project's Jira or Linear integration to link the requirement to (e.g., PROJ-123). Ignored when the project has no such integration.",
	list: {
		describe: 'List requirements in a project.',
		epilog: apiDocsEpilog('requirements', 'list-requirements-deprecated'),
		examples: [
			{
				usage: '$0 api requirements list --project-code PRJ',
				description: 'List requirements',
			},
			{
				usage: '$0 api requirements list --project-code PRJ --include tcaseCount',
				description: 'List with test case counts',
			},
		],
	},
	get: {
		describe: 'Get a requirement, with the number of test cases linked to it.',
		epilog: apiDocsEpilog('requirements', 'get-requirement'),
		examples: [
			{
				usage:
					'$0 api requirements get --project-code PRJ --requirement-id 1CJo8oDjj_vkGo2rQAdzz4F',
				description: 'Get a requirement',
			},
		],
	},
	create: {
		describe: 'Create a requirement, optionally linked to a Jira or Linear issue.',
		epilog: apiDocsEpilog('requirements', 'create-requirement'),
		examples: [
			{
				usage:
					'$0 api requirements create --project-code PRJ --text "Login" --url https://example.com/spec/login',
				description: 'Create a requirement',
			},
			{
				usage:
					'$0 api requirements create --project-code PRJ --text "Login" --integration-issue-id PROJ-123',
				description: 'Create a requirement linked to a Jira issue',
			},
		],
	},
	update: {
		describe:
			'Update a requirement. Omitted fields are kept; --url "" clears the URL and --integration-issue-id "" removes the issue link.',
		epilog: apiDocsEpilog('requirements', 'update-requirement'),
		examples: [
			{
				usage:
					'$0 api requirements update --project-code PRJ --requirement-id 1CJo8oDjj_vkGo2rQAdzz4F --text "Sign in"',
				description: 'Rename a requirement',
			},
		],
	},
	delete: {
		describe:
			'Delete a requirement. It is unlinked from every test case and cannot be restored; its link is removed from the Jira or Linear issue.',
		epilog: apiDocsEpilog('requirements', 'delete-requirement'),
		examples: [
			{
				usage:
					'$0 api requirements delete --project-code PRJ --requirement-id 1CJo8oDjj_vkGo2rQAdzz4F',
				description: 'Delete a requirement',
			},
		],
	},
} as const

const requirementIdParam: ApiPathParamSpec = {
	name: 'requirement-id',
	type: 'string',
	describe: help['requirement-id'],
	schema: resourceIdSchema,
}

const list: ApiEndpointSpec = {
	id: 'requirements.list',
	commandPath: ['requirements', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['created_at', 'text'],
		},
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
		{ name: 'include', type: 'string', describe: help.include },
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.requirements.list(
				pathParams['project-code'],
				query as Parameters<typeof api.requirements.list>[1]
			)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'requirements.get',
	commandPath: ['requirements', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, requirementIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.requirements.get(pathParams['project-code'], pathParams['requirement-id']))
	},
}

const create: ApiEndpointSpec = {
	id: 'requirements.create',
	commandPath: ['requirements', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'text',
			type: 'string',
			describe: help.text,
			schema: CreateRequirementRequestSchema.shape.text,
		},
		{
			name: 'url',
			type: 'string',
			describe: help.url,
			schema: CreateRequirementRequestSchema.shape.url.unwrap(),
		},
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: help['integration-issue-id'],
			schema: CreateRequirementRequestSchema.shape.integrationIssueId.unwrap(),
		},
	],
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv.text !== undefined
			? true
			: 'Either --body, --body-file, or --text is required',
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.requirements.create(
				pathParams['project-code'],
				body as Parameters<typeof api.requirements.create>[1]
			)
		)
	},
}

const updateFields = ['text', 'url', 'integration-issue-id']

const update: ApiEndpointSpec = {
	id: 'requirements.update',
	commandPath: ['requirements', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, requirementIdParam],
	fieldOptions: [
		{
			name: 'text',
			type: 'string',
			describe: help.text,
			schema: UpdateRequirementRequestSchema.shape.text.unwrap(),
		},
		{
			name: 'url',
			type: 'string',
			describe: `${help.url} Pass "" to clear it.`,
			schema: UpdateRequirementRequestSchema.shape.url.unwrap(),
		},
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: `${help['integration-issue-id']} Pass "" to remove the link.`,
			schema: UpdateRequirementRequestSchema.shape.integrationIssueId.unwrap(),
		},
	],
	check: (argv) => {
		const hasField = updateFields.some((f) => argv[f] !== undefined)
		if (argv.body === undefined && argv['body-file'] === undefined && !hasField) {
			const fieldList = updateFields.map((f) => `--${f}`).join(', ')
			return `At least one field to update is required (--body, --body-file, ${fieldList})`
		}
		return true
	},
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.requirements.update(
				pathParams['project-code'],
				pathParams['requirement-id'],
				body as Parameters<typeof api.requirements.update>[2]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'requirements.delete',
	commandPath: ['requirements', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, requirementIdParam],
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.requirements.delete(pathParams['project-code'], pathParams['requirement-id'])
		)
	},
}

export const requirementSpecs: ApiEndpointSpec[] = [list, get, create, update, remove]
