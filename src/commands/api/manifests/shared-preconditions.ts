import { CreateSharedPreconditionRequestSchema } from '../../../api/shared-preconditions'
import { sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, intIdParam, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	id: 'Shared precondition ID.',
	include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
	title: 'Shared precondition title (1-255 characters), unique in the project.',
	text: 'Precondition text (supports HTML).',
	list: {
		describe: 'List shared preconditions in a project.',
		epilog: apiDocsEpilog('shared_preconditions', 'list-shared-preconditions'),
		examples: [
			{
				usage: '$0 api shared-preconditions list --project-code PRJ',
				description: 'List shared preconditions',
			},
		],
	},
	get: {
		describe: 'Get a shared precondition by ID. The response "text" field contains HTML.',
		epilog: apiDocsEpilog('shared_preconditions', 'get-shared-precondition'),
		examples: [
			{
				usage: '$0 api shared-preconditions get --project-code PRJ --id 1',
				description: 'Get a shared precondition',
			},
		],
	},
	create: {
		describe:
			'Create a shared precondition, which test cases reuse through "sharedPreconditionId".',
		epilog: apiDocsEpilog('shared_preconditions', 'create-shared-precondition'),
		examples: [
			{
				usage:
					'$0 api shared-preconditions create --project-code PRJ --title "Logged in" --text "<p>The user is logged in</p>"',
				description: 'Create a shared precondition',
			},
		],
	},
	update: {
		describe:
			"Update a shared precondition's title or text. Every test case that uses it gets a new version.",
		epilog: apiDocsEpilog('shared_preconditions', 'update-shared-precondition'),
		examples: [
			{
				usage:
					'$0 api shared-preconditions update --project-code PRJ --id 1 --text "<p>The user is logged out</p>"',
				description: 'Change the text of a shared precondition',
			},
		],
	},
	delete: {
		describe:
			'Delete a shared precondition for good. Test cases that use it keep its text as a standalone precondition.',
		epilog: apiDocsEpilog('shared_preconditions', 'delete-shared-precondition'),
		examples: [
			{
				usage: '$0 api shared-preconditions delete --project-code PRJ --id 1',
				description: 'Delete a shared precondition',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'shared-preconditions.list',
	commandPath: ['shared-preconditions', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['created_at', 'title'],
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
			await api.sharedPreconditions.list(
				pathParams['project-code'],
				query as Parameters<typeof api.sharedPreconditions.list>[1]
			)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'shared-preconditions.get',
	commandPath: ['shared-preconditions', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.sharedPreconditions.get(pathParams['project-code'], pathParams['id'] as number)
		)
	},
}

const titleField = {
	name: 'title',
	type: 'string',
	describe: help.title,
	schema: CreateSharedPreconditionRequestSchema.shape.title,
} as const

const textField = {
	name: 'text',
	type: 'string',
	describe: help.text,
	schema: CreateSharedPreconditionRequestSchema.shape.text,
} as const

const create: ApiEndpointSpec = {
	id: 'shared-preconditions.create',
	commandPath: ['shared-preconditions', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [titleField, textField],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.sharedPreconditions.create(
				pathParams['project-code'],
				body as Parameters<typeof api.sharedPreconditions.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'shared-preconditions.update',
	commandPath: ['shared-preconditions', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	fieldOptions: [titleField, textField],
	check: (argv) => {
		const hasField = ['title', 'text'].some((f) => argv[f] !== undefined)
		return argv.body !== undefined || argv['body-file'] !== undefined || hasField
			? true
			: 'At least one field to update is required (--body, --body-file, --title, --text)'
	},
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.sharedPreconditions.update(
				pathParams['project-code'],
				pathParams['id'] as number,
				body as Parameters<typeof api.sharedPreconditions.update>[2]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'shared-preconditions.delete',
	commandPath: ['shared-preconditions', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.sharedPreconditions.delete(pathParams['project-code'], pathParams['id'] as number)
		)
	},
}

export const sharedPreconditionSpecs: ApiEndpointSpec[] = [list, get, create, update, remove]
