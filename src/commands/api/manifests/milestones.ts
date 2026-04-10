import { CreateMilestoneRequestSchema } from '../../../api/milestones'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	archived: 'Filter by archived status. If omitted, returns all milestones.',
	title: 'Display title for the milestone (max 255 characters).',
	list: {
		describe: 'List milestones in a project.',
		epilog: apiDocsEpilog('milestone', 'list-project-milestones'),
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

const list: ApiEndpointSpec = {
	id: 'milestones.list',
	commandPath: ['milestones', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [{ name: 'archived', type: 'boolean', describe: help.archived }],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.milestones.list(
				pathParams['project-code'],
				query as Parameters<typeof api.milestones.list>[1]
			)
		)
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

export const milestoneSpecs: ApiEndpointSpec[] = [list, create]
