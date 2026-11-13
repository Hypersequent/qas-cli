import { z } from 'zod'
import { trashResourceTypes, type ListTrashRequest } from '../../../api/trash'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import { commonHelp, idListSchema, paginationOptions, projectCodeParam, splitList } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	'resource-types': `Comma-separated entry types to list: ${trashResourceTypes.join(', ')}. test_case covers deleted folders and test cases.`,
	ids: 'Comma-separated trash entry IDs to restore (1 to 100). They are restored together: if one cannot be, none is.',
	list: {
		describe: 'List trash entries in a project, most recent first.',
		epilog: apiDocsEpilog('trash', 'list-trash'),
		examples: [
			{ usage: '$0 api trash list --project-code PRJ', description: 'List trash entries' },
			{
				usage: '$0 api trash list --project-code PRJ --resource-types test_case',
				description: 'List deleted folders and test cases',
			},
		],
	},
	restore: {
		describe: 'Restore trash entries.',
		epilog: apiDocsEpilog('trash', 'restore-from-trash'),
		examples: [
			{
				usage: '$0 api trash restore --project-code PRJ --ids 1CJo8oDjj_vkGo2rQAdzz4F',
				description: 'Restore a trash entry',
			},
		],
	},
} as const

const resourceTypesSchema = z.string().refine(
	(value) =>
		value
			.split(',')
			.map((item) => item.trim())
			.every((item) => (trashResourceTypes as readonly string[]).includes(item)),
	`must be comma-separated values of ${trashResourceTypes.join(', ')}`
)

const list: ApiEndpointSpec = {
	id: 'trash.list',
	commandPath: ['trash', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'resource-types',
			type: 'string',
			describe: help['resource-types'],
			schema: resourceTypesSchema,
		},
		...paginationOptions(['created_at']),
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		resourceTypes: splitList(query['resource-types']),
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.trash.list(pathParams['project-code'], query as ListTrashRequest))
	},
}

const restore: ApiEndpointSpec = {
	id: 'trash.restore',
	commandPath: ['trash', 'restore'],
	describe: help.restore.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [{ name: 'ids', type: 'string', describe: help.ids, schema: idListSchema }],
	transformFields: (fields) => ({ deleteLogIds: splitList(fields.ids) }),
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv.ids !== undefined
			? true
			: 'Either --body, --body-file, or --ids is required',
	epilog: help.restore.epilog,
	examples: help.restore.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.trash.restore(
				pathParams['project-code'],
				body as Parameters<typeof api.trash.restore>[1]
			)
		)
	},
}

export const trashSpecs: ApiEndpointSpec[] = [list, restore]
