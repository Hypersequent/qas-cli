import { BulkCreateFoldersRequestSchema } from '../../../api/folders'
import { pageParam, limitParam, sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	folders: `JSON array of folder objects. Each folder has a "path" (string array) and optional "comment" (supports HTML).\nExample: '[{"path": ["Parent", "Child"]}]'`,
	list: {
		describe: 'List folders in a project.',
		epilog: apiDocsEpilog('folders', 'list-project-folders'),
		examples: [
			{
				usage: '$0 api folders list --project-code PRJ',
				description: 'List folders in a project',
			},
		],
	},
	bulkCreate: {
		describe: 'Create or update multiple folders at once.',
		epilog: apiDocsEpilog('folders', 'bulk-upsert-folders'),
		examples: [
			{
				usage:
					'$0 api folders bulk-create --project-code PRJ --folders \'[{"path": ["Suite", "Auth"]}]\'',
				description: 'Create nested folders',
			},
			{
				usage:
					'$0 api folders bulk-create --project-code PRJ --body \'{"folders": [{"path": ["Suite", "Auth"]}]}\'',
				description: 'Create folders using --body',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'folders.list',
	commandPath: ['folders', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'page', type: 'number', describe: help.page, schema: pageParam },
		{ name: 'limit', type: 'number', describe: help.limit, schema: limitParam },
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['id', 'project_id', 'title', 'pos', 'parent_id', 'created_at', 'updated_at'],
		},
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.folders.getPaginated(
				pathParams['project-code'],
				query as Parameters<typeof api.folders.getPaginated>[1]
			)
		)
	},
}

const bulkCreate: ApiEndpointSpec = {
	id: 'folders.bulk-create',
	commandPath: ['folders', 'bulk-create'],
	describe: help.bulkCreate.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'folders',
			type: 'string',
			describe: help.folders,
			schema: BulkCreateFoldersRequestSchema,
			jsonParse: true,
		},
	],
	transformFields: (fields) => {
		// The API expects the parsed array directly, not wrapped in an object
		return { folders: fields.folders }
	},
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.folders !== undefined
			? true
			: 'Either --body, --body-file, or --folders is required'
	},
	epilog: help.bulkCreate.epilog,
	examples: help.bulkCreate.examples,
	execute: async (api, { pathParams, body }) => {
		// The body.folders contains the array; API expects the array directly
		const folders = (body as Record<string, unknown>).folders
		printJson(
			await api.folders.bulkCreate(
				pathParams['project-code'],
				folders as Parameters<typeof api.folders.bulkCreate>[1]
			)
		)
	},
}

export const folderSpecs: ApiEndpointSpec[] = [list, bulkCreate]
