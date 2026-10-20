import {
	BulkCreateFoldersRequestSchema,
	CopyFoldersRequestSchema,
	CreateFolderRequestSchema,
	FolderPositionsSchema,
	GetFolderTreeRequestSchema,
	MoveFoldersRequestSchema,
	type ListFoldersRequest,
} from '../../../api/folders'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	idListSchema,
	intIdParam,
	intListSchema,
	paginationOptions,
	projectCodeParam,
	splitIntList,
	splitList,
} from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	folders: `JSON array of folder objects. Each folder has a "path" (string array) and optional "comment" (supports HTML).\nExample: '[{"path": ["Parent", "Child"]}]'`,
	'folder-id': 'Folder ID.',
	'folder-ids': 'Comma-separated folder IDs (e.g., "1,2,3").',
	title: 'Folder name, 1-255 characters, unique among its siblings.',
	'parent-id': 'Parent folder ID; 0 or omitted for a root folder.',
	pos: '0-based position among the siblings; omitted adds the folder last.',
	comment: 'Folder comment (supports HTML). On update, "" clears it.',
	'new-parent-id': 'Folder to move the folders into; 0 for the root.',
	items:
		'JSON array of the folders to move and their final positions among the new parent\'s children. A negative pos counts from the end (-1 is last).\nExample: \'[{"id": 4, "pos": 0}, {"id": 5, "pos": -1}]\'',
	'target-folder-id': 'Folder to copy into; 0 or omitted for the root.',
	'source-project-id': 'Code or ID of the project the folders are in; defaults to --project-code.',
	'tcase-ids': 'Comma-separated test cases to delete too: IDs, sequence numbers or legacy IDs.',
	include:
		'Additional fields to include. tcaseCount adds the number of test cases in each folder and its subtree.',
	list: {
		describe: 'List folders in a project.',
		epilog: apiDocsEpilog('folders', 'list-folders'),
		examples: [
			{
				usage: '$0 api folders list --project-code PRJ',
				description: 'List folders in a project',
			},
		],
	},
	bulkCreate: {
		describe: 'Create or update multiple folders at once.',
		epilog: apiDocsEpilog('folders', 'upsert-folders'),
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
	get: {
		describe: 'Get a folder by ID.',
		epilog: apiDocsEpilog('folders', 'get-folder'),
		examples: [
			{
				usage: '$0 api folders get --project-code PRJ --folder-id 4',
				description: 'Get a folder',
			},
		],
	},
	tree: {
		describe: 'Get all folders of a project as a tree, in the order the web app shows them.',
		epilog: apiDocsEpilog('folders', 'get-folder-tree'),
		examples: [
			{
				usage: '$0 api folders tree --project-code PRJ --include tcaseCount',
				description: 'Get the folder tree with test case counts',
			},
		],
	},
	path: {
		describe: 'Get the folders from the root down to a folder, itself included.',
		epilog: apiDocsEpilog('folders', 'get-folder-path'),
		examples: [
			{
				usage: '$0 api folders path --project-code PRJ --folder-id 4',
				description: 'Get the path of a folder',
			},
		],
	},
	create: {
		describe: 'Create a folder.',
		epilog: apiDocsEpilog('folders', 'create-folder'),
		examples: [
			{
				usage: '$0 api folders create --project-code PRJ --title "Login" --parent-id 4',
				description: 'Create a subfolder',
			},
			{
				usage: '$0 api folders create --project-code PRJ --body \'{"title": "Login"}\'',
				description: 'Create a root folder using --body',
			},
		],
	},
	update: {
		describe: 'Rename a folder or change its comment.',
		epilog: apiDocsEpilog('folders', 'update-folder'),
		examples: [
			{
				usage: '$0 api folders update --project-code PRJ --folder-id 4 --title "Sign in"',
				description: 'Rename a folder',
			},
		],
	},
	move: {
		describe:
			'Move folders, with their subfolders and test cases, under a new parent, or reorder them.',
		epilog: apiDocsEpilog('folders', 'move-folders'),
		examples: [
			{
				usage:
					'$0 api folders move --project-code PRJ --new-parent-id 10 --items \'[{"id": 4, "pos": 0}, {"id": 5, "pos": -1}]\'',
				description: 'Move two folders into folder 10, first and last',
			},
		],
	},
	copy: {
		describe: 'Copy folders, with their subfolders and test cases, into a folder.',
		epilog: apiDocsEpilog('folders', 'copy-folders'),
		examples: [
			{
				usage: '$0 api folders copy --project-code PRJ --folder-ids 4,5 --target-folder-id 10',
				description: 'Copy two folders into folder 10',
			},
			{
				usage: '$0 api folders copy --project-code PRJ --folder-ids 4 --source-project-id OLD',
				description: 'Copy a folder from another project to the root',
			},
		],
	},
	delete: {
		describe:
			'Delete folders with their subfolders and test cases. They go to the trash as one entry.',
		epilog: apiDocsEpilog('folders', 'delete-folders'),
		examples: [
			{
				usage: '$0 api folders delete --project-code PRJ --folder-ids 4,5',
				description: 'Delete two folders',
			},
			{
				usage: '$0 api folders delete --project-code PRJ --folder-ids 4 --tcase-ids 12,13',
				description: 'Delete a folder and two more test cases',
			},
		],
	},
} as const

const folderIdParam = intIdParam('folder-id', help['folder-id'])

const list: ApiEndpointSpec = {
	id: 'folders.list',
	commandPath: ['folders', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: paginationOptions([
		'id',
		'project_id',
		'title',
		'pos',
		'parent_id',
		'created_at',
		'updated_at',
	]),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.folders.list(pathParams['project-code'], query as ListFoldersRequest))
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

const get: ApiEndpointSpec = {
	id: 'folders.get',
	commandPath: ['folders', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, folderIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.folders.get(pathParams['project-code'], pathParams['folder-id']))
	},
}

const tree: ApiEndpointSpec = {
	id: 'folders.tree',
	commandPath: ['folders', 'tree'],
	describe: help.tree.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'include',
			type: 'string',
			describe: help.include,
			schema: GetFolderTreeRequestSchema.shape.include,
			helpChoices: ['tcaseCount'],
		},
	],
	epilog: help.tree.epilog,
	examples: help.tree.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.folders.getTree(
				pathParams['project-code'],
				query as Parameters<typeof api.folders.getTree>[1]
			)
		)
	},
}

const path: ApiEndpointSpec = {
	id: 'folders.path',
	commandPath: ['folders', 'path'],
	describe: help.path.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, folderIdParam],
	epilog: help.path.epilog,
	examples: help.path.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.folders.getPath(pathParams['project-code'], pathParams['folder-id']))
	},
}

const create: ApiEndpointSpec = {
	id: 'folders.create',
	commandPath: ['folders', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateFolderRequestSchema.shape.title,
		},
		{
			name: 'parent-id',
			type: 'number',
			describe: help['parent-id'],
			schema: CreateFolderRequestSchema.shape.parentId,
		},
		{
			name: 'pos',
			type: 'number',
			describe: help.pos,
			schema: CreateFolderRequestSchema.shape.pos,
		},
		{ name: 'comment', type: 'string', describe: help.comment },
	],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.folders.create(
				pathParams['project-code'],
				body as Parameters<typeof api.folders.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'folders.update',
	commandPath: ['folders', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, folderIdParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateFolderRequestSchema.shape.title,
		},
		{ name: 'comment', type: 'string', describe: help.comment },
	],
	check: (argv) => {
		return argv.body !== undefined ||
			argv['body-file'] !== undefined ||
			argv.title !== undefined ||
			argv.comment !== undefined
			? true
			: 'At least one field to update is required (--body, --body-file, --title, --comment)'
	},
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.folders.update(
				pathParams['project-code'],
				pathParams['folder-id'],
				body as Parameters<typeof api.folders.update>[2]
			)
		)
	},
}

const move: ApiEndpointSpec = {
	id: 'folders.move',
	commandPath: ['folders', 'move'],
	describe: help.move.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'new-parent-id',
			type: 'number',
			describe: help['new-parent-id'],
			schema: MoveFoldersRequestSchema.shape.newParentId,
		},
		{
			name: 'items',
			type: 'string',
			describe: help.items,
			schema: FolderPositionsSchema,
			jsonParse: true,
		},
	],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.items !== undefined
			? true
			: 'Either --body, --body-file, or --items is required'
	},
	epilog: help.move.epilog,
	examples: help.move.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.folders.move(
				pathParams['project-code'],
				body as Parameters<typeof api.folders.move>[1]
			)
		)
	},
}

const copy: ApiEndpointSpec = {
	id: 'folders.copy',
	commandPath: ['folders', 'copy'],
	describe: help.copy.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'folder-ids', type: 'string', describe: help['folder-ids'], schema: intListSchema },
		{
			name: 'target-folder-id',
			type: 'number',
			describe: help['target-folder-id'],
			schema: CopyFoldersRequestSchema.shape.targetFolderId,
		},
		{
			name: 'source-project-id',
			type: 'string',
			describe: help['source-project-id'],
			schema: CopyFoldersRequestSchema.shape.sourceProjectId,
		},
	],
	transformFields: (fields) => ({
		...kebabToCamelCaseKeys(fields),
		folderIds: splitIntList(fields['folder-ids']),
	}),
	check: (argv) => {
		return argv.body !== undefined ||
			argv['body-file'] !== undefined ||
			argv['folder-ids'] !== undefined
			? true
			: 'Either --body, --body-file, or --folder-ids is required'
	},
	epilog: help.copy.epilog,
	examples: help.copy.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.folders.copy(
				pathParams['project-code'],
				body as Parameters<typeof api.folders.copy>[1]
			)
		)
	},
}

const del: ApiEndpointSpec = {
	id: 'folders.delete',
	commandPath: ['folders', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'folder-ids', type: 'string', describe: help['folder-ids'], schema: intListSchema },
		{ name: 'tcase-ids', type: 'string', describe: help['tcase-ids'], schema: idListSchema },
	],
	transformFields: (fields) => ({
		folderIds: splitIntList(fields['folder-ids']),
		tcaseIds: splitList(fields['tcase-ids']),
	}),
	check: (argv) => {
		return argv.body !== undefined ||
			argv['body-file'] !== undefined ||
			argv['folder-ids'] !== undefined
			? true
			: 'Either --body, --body-file, or --folder-ids is required'
	},
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.folders.delete(
				pathParams['project-code'],
				body as Parameters<typeof api.folders.delete>[1]
			)
		)
	},
}

export const folderSpecs: ApiEndpointSpec[] = [
	list,
	bulkCreate,
	get,
	tree,
	path,
	create,
	update,
	move,
	copy,
	del,
]
