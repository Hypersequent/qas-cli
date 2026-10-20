import { z } from 'zod'
import {
	CreateProjectRequestSchema,
	projectLinksSchema,
	projectTeamMembersSchema,
	userRoles,
} from '../../../api/projects'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam, splitList } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	code: 'Short project code (2-5 alphanumeric characters, e.g., "PRJ"). Used in URLs and test case references.',
	title: 'Display title for the project (max 255 characters).',
	links:
		'JSON array of project links. Each link has "text" and "url" fields.\nExample: \'[{"text": "Docs", "url": "https://example.com"}]\'',
	'overview-title': 'Title for the project overview page (max 255 characters).',
	'overview-description': 'Description for the project overview page (supports HTML).',
	archived:
		'Archive (true) or unarchive (false) the project. Archiving makes everything in it read-only, except this command.',
	'update-links':
		'JSON array that replaces the project links; [] removes them. Each link has "text" and "url" fields.\nExample: \'[{"text": "Docs", "url": "https://example.com"}]\'',
	'team-members':
		'JSON array that replaces the project\'s team (shown on its overview page), in display order; [] clears it. Each member has "userId" (a user with access to the project) and "role" (their role in the team, as free text).\nExample: \'[{"userId": 1, "role": "QA lead"}]\'',
	roles: `Comma-separated global roles to filter by: ${userRoles.join(', ')}.`,
	list: {
		describe: 'List all projects.',
		epilog: apiDocsEpilog('projects', 'list-projects'),
		examples: [{ usage: '$0 api projects list', description: 'List all projects' }],
	},
	get: {
		describe: 'Get a project by code or ID, with its team members.',
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
	update: {
		describe:
			"Update a project's title, overview, links or team, or archive or unarchive it. Owners and admins only. It also works on an archived project, which stays archived unless --archived false is passed.",
		epilog: apiDocsEpilog('projects', 'update-project'),
		examples: [
			{
				usage: '$0 api projects update --project-code PRJ --title "Checkout"',
				description: 'Rename a project',
			},
			{
				usage: '$0 api projects update --project-code PRJ --archived false',
				description: 'Unarchive a project',
			},
			{
				usage:
					'$0 api projects update --project-code PRJ --team-members \'[{"userId": 1, "role": "QA lead"}]\'',
				description: 'Replace the team card',
			},
		],
	},
	usersList: {
		describe:
			'List the users who can access a project: owners, admins, and users given access to it or to all projects.',
		epilog: apiDocsEpilog('projects', 'list-project-users'),
		examples: [
			{
				usage: '$0 api projects users list --project-code PRJ',
				description: 'List the users of a project',
			},
			{
				usage: '$0 api projects users list --project-code PRJ --roles user,test-runner',
				description: 'List the users with some roles',
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

const updateFields = [
	'title',
	'archived',
	'overview-title',
	'overview-description',
	'links',
	'team-members',
]

const update: ApiEndpointSpec = {
	id: 'projects.update',
	commandPath: ['projects', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateProjectRequestSchema.shape.title,
		},
		{ name: 'archived', type: 'boolean', describe: help.archived },
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
		{
			name: 'links',
			type: 'string',
			describe: help['update-links'],
			schema: projectLinksSchema,
			jsonParse: true,
		},
		{
			name: 'team-members',
			type: 'string',
			describe: help['team-members'],
			schema: projectTeamMembersSchema,
			jsonParse: true,
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
			await api.projects.update(
				pathParams['project-code'],
				body as Parameters<typeof api.projects.update>[1]
			)
		)
	},
}

const rolesSchema = z.string().refine(
	(value) =>
		value
			.split(',')
			.map((item) => item.trim())
			.every((item) => (userRoles as readonly string[]).includes(item)),
	`must be comma-separated values of ${userRoles.join(', ')}`
)

const usersList: ApiEndpointSpec = {
	id: 'projects.users.list',
	commandPath: ['projects', 'users', 'list'],
	describe: help.usersList.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [{ name: 'roles', type: 'string', describe: help.roles, schema: rolesSchema }],
	transformQuery: (query) => ({ roles: splitList(query.roles) }),
	epilog: help.usersList.epilog,
	examples: help.usersList.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.projects.listUsers(
				pathParams['project-code'],
				query as Parameters<typeof api.projects.listUsers>[1]
			)
		)
	},
}

export const projectSpecs: ApiEndpointSpec[] = [list, get, create, update, usersList]
