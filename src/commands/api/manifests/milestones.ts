import type { Api } from '../../../api/index'
import {
	CreateMilestoneRequestSchema,
	type ListMilestonesRequest,
	type UpdateMilestoneRequest,
} from '../../../api/milestones'
import { printJson, apiDocsEpilog } from '../utils'
import {
	commonHelp,
	intIdParam,
	paginationOptions,
	projectCodeParam,
	requireAnyFieldOrBody,
} from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	archived: 'Filter by archived status. If omitted, returns all milestones.',
	title: 'Display title for the milestone (max 255 characters).',
	'milestone-id': 'Milestone ID.',
	get: {
		describe: 'Get a milestone.',
		epilog: apiDocsEpilog('milestone', 'get-milestone'),
		examples: [
			{
				usage: '$0 api milestones get --project-code PRJ --milestone-id 1',
				description: 'Get a milestone',
			},
		],
	},
	update: {
		describe: 'Update a milestone. Fields left out keep their values.',
		epilog: apiDocsEpilog('milestone', 'update-milestone'),
		examples: [
			{
				usage: '$0 api milestones update --project-code PRJ --milestone-id 1 --title "v1.1"',
				description: 'Rename a milestone',
			},
		],
	},
	archive: {
		describe:
			'Archive a milestone, closing every open test plan and test run in it. Reports how many test plans and standalone runs it closed.',
		epilog: apiDocsEpilog('milestone', 'archive-milestone'),
		examples: [
			{
				usage: '$0 api milestones archive --project-code PRJ --milestone-id 1',
				description: 'Archive a milestone',
			},
		],
	},
	unarchive: {
		describe:
			'Unarchive a milestone. The test plans and runs that archiving closed stay closed; reopen them one by one.',
		epilog: apiDocsEpilog('milestone', 'unarchive-milestone'),
		examples: [
			{
				usage: '$0 api milestones unarchive --project-code PRJ --milestone-id 1',
				description: 'Unarchive a milestone',
			},
		],
	},
	delete: {
		describe:
			'Delete a milestone with every test plan and test run in it. They go to the trash as one entry, which trash restore brings back together.',
		epilog: apiDocsEpilog('milestone', 'delete-milestone'),
		examples: [
			{
				usage: '$0 api milestones delete --project-code PRJ --milestone-id 1',
				description: 'Delete a milestone',
			},
		],
	},
	list: {
		describe: 'List milestones in a project.',
		epilog: apiDocsEpilog('milestone', 'list-milestones'),
		examples: [
			{
				usage: '$0 api milestones list --project-code PRJ',
				description: 'List milestones in a project',
			},
		],
	},
	create: {
		describe: 'Create a new milestone.',
		epilog: apiDocsEpilog('milestone', 'create-milestone'),
		examples: [
			{
				usage: '$0 api milestones create --project-code PRJ --title "v1.0"',
				description: 'Create a new milestone',
			},
			{
				usage: '$0 api milestones create --project-code PRJ --body \'{"title": "v2.0"}\'',
				description: 'Create a milestone using --body',
			},
		],
	},
} as const

const milestoneIdParam = intIdParam('milestone-id', help['milestone-id'])

const stateSpec = (
	action: 'archive' | 'unarchive' | 'delete',
	text: { describe: string; epilog: string; examples: ApiEndpointSpec['examples'] },
	call: (api: Api, projectCode: string | number, milestoneId: string | number) => Promise<unknown>
): ApiEndpointSpec => ({
	id: `milestones.${action}`,
	commandPath: ['milestones', action],
	describe: text.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, milestoneIdParam],
	epilog: text.epilog,
	examples: text.examples,
	execute: async (api, { pathParams }) => {
		printJson(await call(api, pathParams['project-code'], pathParams['milestone-id']))
	},
})

const list: ApiEndpointSpec = {
	id: 'milestones.list',
	commandPath: ['milestones', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'archived', type: 'boolean', describe: help.archived },
		...paginationOptions(['title', 'created_at', 'updated_at', 'archived_at']),
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.milestones.list(pathParams['project-code'], query as ListMilestonesRequest))
	},
}

const get: ApiEndpointSpec = {
	id: 'milestones.get',
	commandPath: ['milestones', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, milestoneIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.milestones.get(pathParams['project-code'], pathParams['milestone-id']))
	},
}

const create: ApiEndpointSpec = {
	id: 'milestones.create',
	commandPath: ['milestones', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateMilestoneRequestSchema.shape.title,
		},
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
			await api.milestones.create(
				pathParams['project-code'],
				body as Parameters<typeof api.milestones.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'milestones.update',
	commandPath: ['milestones', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, milestoneIdParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateMilestoneRequestSchema.shape.title,
		},
	],
	check: requireAnyFieldOrBody('title'),
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.milestones.update(
				pathParams['project-code'],
				pathParams['milestone-id'],
				body as UpdateMilestoneRequest
			)
		)
	},
}

const archive = stateSpec('archive', help.archive, (api, code, id) =>
	api.milestones.archive(code, id)
)

const unarchive = stateSpec('unarchive', help.unarchive, (api, code, id) =>
	api.milestones.unarchive(code, id)
)

const remove = stateSpec('delete', help.delete, (api, code, id) => api.milestones.delete(code, id))

export const milestoneSpecs: ApiEndpointSpec[] = [
	list,
	get,
	create,
	update,
	archive,
	unarchive,
	remove,
]
