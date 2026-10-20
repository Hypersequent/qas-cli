import {
	CreateTagRequestSchema,
	RenameTagsRequestSchema,
	UpdateTagRequestSchema,
	type ListTagsRequest,
} from '../../../api/tags'
import { printJson, apiDocsEpilog } from '../utils'
import {
	intIdParam,
	intListSchema,
	paginationOptions,
	projectCodeParam,
	splitIntList,
} from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	title: 'Tag title, 1-255 characters, unique in the project.',
	tags: `JSON array of tags to rename, each with its "id" and new "title".\nExample: '[{"id": 1, "title": "smoke"}]'`,
	'tag-ids': 'Comma-separated IDs of the tags to delete (e.g., "1,2").',
	include: 'Additional fields to include. tcaseCount adds the number of test cases with the tag.',
	list: {
		describe: 'List the tags of a project.',
		epilog: apiDocsEpilog('tag', 'list-tags'),
		examples: [
			{ usage: '$0 api tags list --project-code PRJ', description: 'List tags in a project' },
		],
	},
	create: {
		describe: 'Create a tag.',
		epilog: apiDocsEpilog('tag', 'create-tag'),
		examples: [
			{ usage: '$0 api tags create --project-code PRJ --title smoke', description: 'Create a tag' },
		],
	},
	update: {
		describe: 'Update a tag. Test cases keep the tag under its new title.',
		epilog: apiDocsEpilog('tag', 'rename-tag'),
		examples: [
			{
				usage: '$0 api tags update --project-code PRJ --tag-id 1 --title regression',
				description: 'Update a tag',
			},
		],
	},
	rename: {
		describe: 'Rename several tags at once.',
		epilog: apiDocsEpilog('tag', 'rename-tags'),
		examples: [
			{
				usage:
					'$0 api tags rename --project-code PRJ --tags \'[{"id": 1, "title": "smoke"}, {"id": 2, "title": "e2e"}]\'',
				description: 'Rename two tags',
			},
		],
	},
	delete: {
		describe:
			'Delete tags. They are removed from every test case and cannot be restored. An open live run filtered only by deleted tags stops filtering by tag, so it takes in every test case its other filters match.',
		epilog: apiDocsEpilog('tag', 'delete-tags'),
		examples: [
			{
				usage: '$0 api tags delete --project-code PRJ --tag-ids 1,2',
				description: 'Delete two tags',
			},
		],
	},
} as const

const tagIdParam = intIdParam('tag-id', 'Tag ID.')

const list: ApiEndpointSpec = {
	id: 'tags.list',
	commandPath: ['tags', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'include', type: 'string', describe: help.include, helpChoices: ['tcaseCount'] },
		...paginationOptions(['created_at', 'title']),
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.tags.list(pathParams['project-code'], query as ListTagsRequest))
	},
}

const create: ApiEndpointSpec = {
	id: 'tags.create',
	commandPath: ['tags', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateTagRequestSchema.shape.title,
		},
	],
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required',
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.tags.create(
				pathParams['project-code'],
				body as Parameters<typeof api.tags.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'tags.update',
	commandPath: ['tags', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, tagIdParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: UpdateTagRequestSchema.shape.title,
		},
	],
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required',
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.tags.update(
				pathParams['project-code'],
				pathParams['tag-id'],
				body as Parameters<typeof api.tags.update>[2]
			)
		)
	},
}

const rename: ApiEndpointSpec = {
	id: 'tags.rename',
	commandPath: ['tags', 'rename'],
	describe: help.rename.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'tags',
			type: 'string',
			describe: help.tags,
			schema: RenameTagsRequestSchema.shape.tags,
			jsonParse: true,
		},
	],
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv.tags !== undefined
			? true
			: 'Either --body, --body-file, or --tags is required',
	epilog: help.rename.epilog,
	examples: help.rename.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.tags.rename(
				pathParams['project-code'],
				body as Parameters<typeof api.tags.rename>[1]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'tags.delete',
	commandPath: ['tags', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'tag-ids', type: 'string', describe: help['tag-ids'], schema: intListSchema },
	],
	transformFields: (fields) => ({ tagIds: splitIntList(fields['tag-ids']) }),
	check: (argv) =>
		argv.body !== undefined || argv['body-file'] !== undefined || argv['tag-ids'] !== undefined
			? true
			: 'Either --body, --body-file, or --tag-ids is required',
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.tags.delete(
				pathParams['project-code'],
				body as Parameters<typeof api.tags.delete>[1]
			)
		)
	},
}

export const tagSpecs: ApiEndpointSpec[] = [list, create, update, rename, remove]
