import { CreateProjectRequestSchema, projectLinksSchema } from '../../../api/projects'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	code: 'Short project code (2-5 alphanumeric characters, e.g., "PRJ"). Used in URLs and test case references.',
	title: 'Display title for the project (max 255 characters).',
	links:
		'JSON array of project links. Each link has "text" and "url" fields.\nExample: \'[{"text": "Docs", "url": "https://example.com"}]\'',
	'overview-title': 'Title for the project overview page (max 255 characters).',
	'overview-description': 'Description for the project overview page (supports HTML).',
	list: {
		describe: 'List all projects.',
		epilog: apiDocsEpilog('projects', 'list-projects'),
		examples: [{ usage: '$0 api projects list', description: 'List all projects' }],
	},
	get: {
		describe: 'Get a project by code or ID.',
		epilog: apiDocsEpilog('projects', 'get-project'),
		examples: [
			{ usage: '$0 api projects get --project-code PRJ', description: 'Get a project by code' },
		],
	},
	create: {
		describe: 'Create a new project.',
		epilog: apiDocsEpilog('projects', 'create-project'),
		examples: [
			{
				usage: '$0 api projects create --code PRJ --title "My Project"',
				description: 'Create a new project',
			},
			{
				usage: '$0 api projects create --body \'{"code": "PRJ", "title": "My Project"}\'',
				description: 'Create a project using --body',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'projects.list',
	commandPath: ['projects', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api) => {
		printJson(await api.projects.list())
	},
}

const get: ApiEndpointSpec = {
	id: 'projects.get',
	commandPath: ['projects', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.projects.get(pathParams['project-code']))
	},
}

const create: ApiEndpointSpec = {
	id: 'projects.create',
	commandPath: ['projects', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [],
	fieldOptions: [
		{
			name: 'code',
			type: 'string',
			describe: help.code,
			schema: CreateProjectRequestSchema.shape.code,
		},
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateProjectRequestSchema.shape.title,
		},
		{
			name: 'links',
			type: 'string',
			describe: help.links,
			schema: projectLinksSchema,
			jsonParse: true,
		},
		{
			name: 'overview-title',
			type: 'string',
			describe: help['overview-title'],
			schema: CreateProjectRequestSchema.shape.overviewTitle.unwrap(),
		},
		{
			name: 'overview-description',
			type: 'string',
			describe: help['overview-description'],
			schema: CreateProjectRequestSchema.shape.overviewDescription.unwrap(),
		},
	],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.code !== undefined
			? true
			: 'Either --body, --body-file, or --code is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { body }) => {
		printJson(await api.projects.create(body as Parameters<typeof api.projects.create>[0]))
	},
}

export const projectSpecs: ApiEndpointSpec[] = [list, get, create]
