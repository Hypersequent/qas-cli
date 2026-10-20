import { z } from 'zod'
import { configurationTitleSchema } from '../../../api/configurations'
import {
	limitParam,
	offsetParam,
	resourceIdSchema,
	sortFieldParam,
	sortOrderParam,
} from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import { commonHelp, projectCodeParam, splitList } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	id: 'Configuration ID.',
	title: 'Configuration name (1-64 characters), unique in the project, e.g. "Chrome".',
	include: 'Include additional fields. Use "runCount" to include the number of runs using each.',
	list: {
		describe: 'List the configurations of a project, the environments runs target.',
		epilog: apiDocsEpilog('configurations', 'list-configurations'),
		examples: [
			{
				usage: '$0 api configurations list --project-code PRJ',
				description: 'List configurations',
			},
		],
	},
	get: {
		describe: 'Get a configuration, with the number of runs using it.',
		epilog: apiDocsEpilog('configurations', 'get-configuration'),
		examples: [
			{
				usage:
					'$0 api configurations get --project-code PRJ --configuration-id 1CJo8oDjj_vkGo2rQAdzz4F',
				description: 'Get a configuration',
			},
		],
	},
	create: {
		describe: 'Create a configuration.',
		epilog: apiDocsEpilog('configurations', 'create-configuration'),
		examples: [
			{
				usage: '$0 api configurations create --project-code PRJ --title Chrome',
				description: 'Create a configuration',
			},
		],
	},
	update: {
		describe: 'Rename a configuration. Runs using it show the new name.',
		epilog: apiDocsEpilog('configurations', 'update-configuration'),
		examples: [
			{
				usage:
					'$0 api configurations update --project-code PRJ --configuration-id 1CJo8oDjj_vkGo2rQAdzz4F --title Firefox',
				description: 'Rename a configuration',
			},
		],
	},
	delete: {
		describe:
			'Delete a configuration for good. Runs that used it keep their results but no longer have a configuration.',
		epilog: apiDocsEpilog('configurations', 'delete-configuration'),
		examples: [
			{
				usage:
					'$0 api configurations delete --project-code PRJ --configuration-id 1CJo8oDjj_vkGo2rQAdzz4F',
				description: 'Delete a configuration',
			},
		],
	},
} as const

const idParam = {
	name: 'configuration-id',
	type: 'string',
	describe: help.id,
	schema: resourceIdSchema,
} as const

const titleField = {
	name: 'title',
	type: 'string',
	describe: help.title,
	schema: configurationTitleSchema,
} as const

const titleCheck = (argv: Record<string, unknown>) =>
	argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
		? true
		: 'Either --body, --body-file, or --title is required'

const list: ApiEndpointSpec = {
	id: 'configurations.list',
	commandPath: ['configurations', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'include',
			type: 'string',
			describe: help.include,
			schema: z.enum(['runCount']),
		},
		{ name: 'offset', type: 'number', describe: help.offset, schema: offsetParam },
		{ name: 'limit', type: 'number', describe: help.limit, schema: limitParam },
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['title', 'created_at'],
		},
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		include: splitList(query.include),
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.configurations.list(
				pathParams['project-code'],
				query as Parameters<typeof api.configurations.list>[1]
			)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'configurations.get',
	commandPath: ['configurations', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, idParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.configurations.get(pathParams['project-code'], pathParams['configuration-id'])
		)
	},
}

const create: ApiEndpointSpec = {
	id: 'configurations.create',
	commandPath: ['configurations', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [titleField],
	check: titleCheck,
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.configurations.create(
				pathParams['project-code'],
				body as Parameters<typeof api.configurations.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'configurations.update',
	commandPath: ['configurations', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, idParam],
	fieldOptions: [titleField],
	check: titleCheck,
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.configurations.update(
				pathParams['project-code'],
				pathParams['configuration-id'],
				body as Parameters<typeof api.configurations.update>[2]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'configurations.delete',
	commandPath: ['configurations', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, idParam],
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.configurations.delete(pathParams['project-code'], pathParams['configuration-id'])
		)
	},
}

export const configurationSpecs: ApiEndpointSpec[] = [list, get, create, update, remove]
