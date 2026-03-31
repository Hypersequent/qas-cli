import { z } from 'zod'
import {
	CreateRunRequestSchema,
	QueryPlansSchema,
	CloneRunRequestSchema,
	type ListRunTCasesRequest,
} from '../../../api/runs'
import { limitParam, sortFieldParam, sortOrderParam, resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCase } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

// CreateRunRequestSchema uses .superRefine() → ZodEffects, so extract inner ZodObject
const CreateRunShape = CreateRunRequestSchema.sourceType().shape

const help = {
	...commonHelp,
	'run-id': 'Test run ID.',
	'tcase-id': 'Test case ID or legacy ID.',
	title: 'Display title for the test run, 1-255 characters.',
	type: 'Run type: static, static_struct, or live.',
	description: 'Optional description for the test run (max 512 characters).',
	'milestone-id': 'ID of the milestone to associate with this run.',
	'configuration-id': 'ID of the configuration to associate with this run.',
	'assignment-id': 'ID of the user to assign to this run.',
	'query-plans':
		'JSON array of query plan objects that select which test cases to include.\nExample: \'[{"tcaseIds": ["abc123"]}]\'',
	closed: 'Filter by closed status. If true, returns only closed runs.',
	'milestone-ids': 'Comma-separated milestone IDs to filter by (e.g., "1,2,3").',
	search: 'Search text to filter test cases.',
	tags: 'Comma-separated tag IDs to filter by.',
	priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
	include: 'Include additional fields. Use "folder" to include folder details.',
	create: {
		describe: 'Create a new test run.',
		epilog: apiDocsEpilog('run', 'create-new-run'),
		examples: [
			{
				usage:
					'$0 api runs create --project-code PRJ --title "Sprint 1" --type static --query-plans \'[{"tcaseIds": ["abc123"]}]\'',
				description: 'Create a static run with specific test cases',
			},
			{
				usage:
					'$0 api runs create --project-code PRJ --body \'{"title": "Sprint 1", "type": "static", "queryPlans": [{"tcaseIds": ["abc123"]}]}\'',
				description: 'Create a run using --body',
			},
		],
	},
	list: {
		describe: 'List test runs in a project.',
		epilog: apiDocsEpilog('run', 'list-project-runs'),
		examples: [
			{
				usage: '$0 api runs list --project-code PRJ',
				description: 'List test runs in a project',
			},
		],
	},
	clone: {
		describe: 'Clone an existing test run.',
		epilog: apiDocsEpilog('run', 'clone-existing-run'),
		examples: [
			{
				usage: '$0 api runs clone --project-code PRJ --run-id 1 --title "Clone of Run 1"',
				description: 'Clone a run with individual fields',
			},
			{
				usage:
					'$0 api runs clone --project-code PRJ --body \'{"runId": 1, "title": "Clone of Run 1"}\'',
				description: 'Clone a run using --body',
			},
		],
	},
	close: {
		describe: 'Close a test run.',
		epilog: apiDocsEpilog('run', 'close-run'),
		examples: [
			{
				usage: '$0 api runs close --project-code PRJ --run-id 1',
				description: 'Close a test run',
			},
		],
	},
	tcasesList: {
		describe: 'List test cases in a run.',
		epilog: apiDocsEpilog('run', 'list-run-test-cases'),
		examples: [
			{
				usage: '$0 api runs test-cases list --project-code PRJ --run-id 1',
				description: 'List test cases in a run',
			},
		],
	},
	tcasesGet: {
		describe: 'Get a specific test case in a run.',
		epilog: apiDocsEpilog('run', 'get-run-test-case'),
		examples: [
			{
				usage: '$0 api runs test-cases get --project-code PRJ --run-id 1 --tcase-id tc1',
				description: 'Get a specific test case in a run',
			},
		],
	},
} as const

const runIdParam = {
	name: 'run-id',
	type: 'number' as const,
	describe: help['run-id'],
	schema: z.number().int().positive('must be a positive integer'),
}

const create: ApiEndpointSpec = {
	id: 'runs.create',
	commandPath: ['runs', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'title', type: 'string', describe: help.title, schema: CreateRunShape.title },
		{
			name: 'type',
			type: 'string',
			describe: help.type,
			choices: ['static', 'static_struct', 'live'],
		},
		{
			name: 'description',
			type: 'string',
			describe: help.description,
			schema: CreateRunShape.description.unwrap(),
		},
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['milestone-id'],
			schema: CreateRunShape.milestoneId.unwrap(),
		},
		{
			name: 'configuration-id',
			type: 'string',
			describe: help['configuration-id'],
			schema: CreateRunShape.configurationId.unwrap(),
		},
		{
			name: 'assignment-id',
			type: 'number',
			describe: help['assignment-id'],
			schema: CreateRunShape.assignmentId.unwrap(),
		},
		{
			name: 'query-plans',
			type: 'string',
			describe: help['query-plans'],
			schema: QueryPlansSchema,
			jsonParse: true,
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
			await api.runs.create(
				pathParams['project-code'],
				body as Parameters<typeof api.runs.create>[1]
			)
		)
	},
}

const list: ApiEndpointSpec = {
	id: 'runs.list',
	commandPath: ['runs', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'closed', type: 'boolean', describe: help.closed },
		{ name: 'milestone-ids', type: 'string', describe: help['milestone-ids'] },
		{ name: 'limit', type: 'number', describe: help.limit, schema: limitParam },
	],
	transformQuery: (query) => ({
		...kebabToCamelCase(query),
		milestoneIds:
			typeof query['milestone-ids'] === 'string'
				? query['milestone-ids'].split(',').map(Number)
				: query['milestone-ids'],
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.runs.list(pathParams['project-code'], query as Parameters<typeof api.runs.list>[1])
		)
	},
}

const clone: ApiEndpointSpec = {
	id: 'runs.clone',
	commandPath: ['runs', 'clone'],
	describe: help.clone.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'run-id',
			type: 'number',
			describe: 'Test run ID to clone.',
			schema: CloneRunRequestSchema.shape.runId,
		},
		{
			name: 'title',
			type: 'string',
			describe: 'Display title for the cloned run (1-255 characters).',
			schema: CloneRunRequestSchema.shape.title,
		},
		{
			name: 'description',
			type: 'string',
			describe: 'Optional description for the cloned run (supports HTML).',
			schema: CloneRunRequestSchema.shape.description.unwrap(),
		},
		{
			name: 'milestone-id',
			type: 'number',
			describe: 'Milestone ID for the cloned run.',
			schema: CloneRunRequestSchema.shape.milestoneId.unwrap(),
		},
		{
			name: 'assignment-id',
			type: 'number',
			describe: 'Assignment ID for the cloned run.',
			schema: CloneRunRequestSchema.shape.assignmentId.unwrap(),
		},
	],

	check: (argv) => {
		return argv.body !== undefined ||
			argv['body-file'] !== undefined ||
			argv['run-id'] !== undefined
			? true
			: 'Either --body, --body-file, or --run-id is required'
	},
	epilog: help.clone.epilog,
	examples: help.clone.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.runs.clone(pathParams['project-code'], body as Parameters<typeof api.runs.clone>[1])
		)
	},
}

const close: ApiEndpointSpec = {
	id: 'runs.close',
	commandPath: ['runs', 'close'],
	describe: help.close.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	epilog: help.close.epilog,
	examples: help.close.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.runs.close(pathParams['project-code'], pathParams['run-id']))
	},
}

const tcasesList: ApiEndpointSpec = {
	id: 'runs.tcases.list',
	commandPath: ['runs', 'test-cases', 'list'],
	describe: help.tcasesList.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	queryOptions: [
		{ name: 'search', type: 'string', describe: help.search },
		{ name: 'tags', type: 'string', describe: help.tags },
		{ name: 'priorities', type: 'string', describe: help.priorities },
		{ name: 'include', type: 'string', describe: help.include },
		{ name: 'sort-field', type: 'string', describe: help['sort-field'], schema: sortFieldParam },
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
	],
	transformQuery: (query) => ({
		...kebabToCamelCase(query),
		tags: typeof query.tags === 'string' ? query.tags.split(',').map(Number) : query.tags,
		priorities:
			typeof query.priorities === 'string' ? query.priorities.split(',') : query.priorities,
	}),
	epilog: help.tcasesList.epilog,
	examples: help.tcasesList.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.runs.listTCases(
				pathParams['project-code'],
				pathParams['run-id'],
				query as ListRunTCasesRequest
			)
		)
	},
}

const tcasesGet: ApiEndpointSpec = {
	id: 'runs.tcases.get',
	commandPath: ['runs', 'test-cases', 'get'],
	describe: help.tcasesGet.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		runIdParam,
		{ name: 'tcase-id', type: 'string', describe: help['tcase-id'], schema: resourceIdSchema },
	],
	epilog: help.tcasesGet.epilog,
	examples: help.tcasesGet.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.runs.getTCase(
				pathParams['project-code'],
				pathParams['run-id'],
				pathParams['tcase-id']
			)
		)
	},
}

export const runSpecs: ApiEndpointSpec[] = [create, list, clone, close, tcasesList, tcasesGet]
