import { z } from 'zod'
import {
	CreateTCaseRequestSchema,
	UpdateTCaseRequestSchema,
	StepsArraySchema,
	customFieldsSchema,
	parameterValueSchema,
	parameterValueWithIdSchema,
	type ListTCasesRequest,
	type CountTCasesRequest,
} from '../../../api/tcases'

// CreateTCaseRequestSchema uses .superRefine() → ZodEffects, so extract inner ZodObject
const CreateTCaseShape = CreateTCaseRequestSchema.sourceType().shape
import { pageParam, limitParam, sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCase } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	'tcase-id': 'Test case ID.',
	title: 'Test case title, 1-511 characters.',
	priority: 'Priority level, low/medium/high.',
	'precondition-text':
		'Precondition text (supports HTML). Mutually exclusive with --precondition-id.',
	'precondition-id': 'Shared precondition ID. Mutually exclusive with --precondition-text.',
	tags: 'Comma-separated tag names (e.g., "smoke,regression").',
	'is-draft': 'Whether the test case is a draft.',
	draft: 'Filter by draft status (true or false).',
	steps:
		'JSON array of step objects.\nExample: \'[{"description": "Click login", "expected": "Page loads"}]\'',
	'custom-fields':
		'JSON object mapping custom field keys to values.\nExample: \'{"field1": {"isDefault": false, "value": "some value"}}\'',
	'parameter-values':
		'JSON array of parameter value sets.\nExample: \'[{"values": {"browser": "Chrome"}}]\'',
	folders: 'Comma-separated folder IDs to filter by (e.g., "1,2,3").',
	tagsFilter: 'Comma-separated tag IDs to filter by (e.g., "1,2,3").',
	priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
	list: {
		describe: 'List test cases in a project.',
		epilog: apiDocsEpilog('tcases', 'list-project-test-cases'),
		examples: [
			{
				usage: '$0 api test-cases list --project-code PRJ',
				description: 'List test cases in a project',
			},
		],
	},
	get: {
		describe: 'Get a test case by ID.',
		epilog: apiDocsEpilog('tcases', 'get-test-case'),
		examples: [
			{
				usage: '$0 api test-cases get --project-code PRJ --tcase-id tc1',
				description: 'Get a test case by ID',
			},
		],
	},
	count: {
		describe: 'Count test cases matching filters.',
		epilog: apiDocsEpilog('tcases', 'get-test-case-count'),
		examples: [
			{
				usage: '$0 api test-cases count --project-code PRJ',
				description: 'Count test cases in a project',
			},
		],
	},
	create: {
		describe: 'Create a new test case.',
		epilog: apiDocsEpilog('tcases', 'create-test-case'),
		examples: [
			{
				usage:
					'$0 api test-cases create --project-code PRJ --title "Login test" --type standalone --folder-id 1 --priority high',
				description: 'Create a test case with individual fields',
			},
			{
				usage:
					'$0 api test-cases create --project-code PRJ --body \'{"title": "Login test", "type": "standalone", "folderId": 1, "priority": "high"}\'',
				description: 'Create a test case',
			},
		],
	},
	update: {
		describe: 'Update an existing test case.',
		epilog: apiDocsEpilog('tcases', 'update-test-case'),
		examples: [
			{
				usage:
					'$0 api test-cases update --project-code PRJ --tcase-id tc1 --title "Updated title" --priority high',
				description: 'Update a test case with individual fields',
			},
			{
				usage:
					'$0 api test-cases update --project-code PRJ --tcase-id tc1 --body \'{"title": "Updated title", "priority": "high"}\'',
				description: 'Update a test case using --body',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'test-cases.list',
	commandPath: ['test-cases', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'page',
			type: 'number',
			describe: 'Page number for pagination (starts at 1).',
			schema: pageParam,
		},
		{
			name: 'limit',
			type: 'number',
			describe: 'Maximum number of items per page.',
			schema: limitParam,
		},
		{ name: 'folders', type: 'string', describe: help.folders },
		{ name: 'tags', type: 'string', describe: help.tagsFilter },
		{ name: 'priorities', type: 'string', describe: help.priorities },
		{ name: 'search', type: 'string', describe: 'Search text to filter test cases.' },
		{
			name: 'types',
			type: 'string',
			describe: 'Comma-separated test case types to filter by (e.g., "standalone,template").',
		},
		{ name: 'draft', type: 'boolean', describe: help.draft },
		{ name: 'sort-field', type: 'string', describe: help['sort-field'], schema: sortFieldParam },
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
		{
			name: 'include',
			type: 'string',
			describe:
				'Comma-separated additional fields to include.\nValid values: steps, tags, requirements, customFields, parameterValues, folder, path, project.',
		},
	],
	transformQuery: (query) => ({
		...kebabToCamelCase(query),
		folders:
			typeof query.folders === 'string' ? query.folders.split(',').map(Number) : query.folders,
		tags: typeof query.tags === 'string' ? query.tags.split(',').map(Number) : query.tags,
		priorities:
			typeof query.priorities === 'string' ? query.priorities.split(',') : query.priorities,
		types: typeof query.types === 'string' ? query.types.split(',') : query.types,
		include: typeof query.include === 'string' ? query.include.split(',') : query.include,
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.testCases.list(pathParams['project-code'], query as ListTCasesRequest))
	},
}

const get: ApiEndpointSpec = {
	id: 'test-cases.get',
	commandPath: ['test-cases', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		{ name: 'tcase-id', type: 'string', describe: help['tcase-id'], schema: resourceIdSchema },
	],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.testCases.get(pathParams['project-code'], pathParams['tcase-id']))
	},
}

const count: ApiEndpointSpec = {
	id: 'test-cases.count',
	commandPath: ['test-cases', 'count'],
	describe: help.count.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'folders', type: 'string', describe: help.folders },
		{
			name: 'recursive',
			type: 'boolean',
			describe: 'If true, include test cases in subfolders when filtering by folders.',
		},
		{ name: 'tags', type: 'string', describe: help.tagsFilter },
		{ name: 'priorities', type: 'string', describe: help.priorities },
		{ name: 'draft', type: 'boolean', describe: help.draft },
	],
	transformQuery: (query) => ({
		...kebabToCamelCase(query),
		folders:
			typeof query.folders === 'string' ? query.folders.split(',').map(Number) : query.folders,
		tags: typeof query.tags === 'string' ? query.tags.split(',').map(Number) : query.tags,
		priorities:
			typeof query.priorities === 'string' ? query.priorities.split(',') : query.priorities,
	}),
	epilog: help.count.epilog,
	examples: help.count.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.testCases.count(pathParams['project-code'], query as CountTCasesRequest))
	},
}

function transformTCaseFields(fields: Record<string, unknown>): Record<string, unknown> {
	const result = kebabToCamelCase(fields)

	// Handle precondition union
	if (fields['precondition-text']) {
		result.precondition = { text: fields['precondition-text'] }
	} else if (fields['precondition-id']) {
		result.precondition = { sharedPreconditionId: fields['precondition-id'] }
	}
	delete result.preconditionText
	delete result.preconditionId

	// Handle comma-separated tags
	if (typeof fields.tags === 'string') {
		result.tags = fields.tags.split(',')
	}

	return result
}

const tcaseCreate: ApiEndpointSpec = {
	id: 'test-cases.create',
	commandPath: ['test-cases', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'title', type: 'string', describe: help.title, schema: CreateTCaseShape.title },
		{
			name: 'type',
			type: 'string',
			describe: 'Test case type, standalone or template.',
			choices: ['standalone', 'template'] as const,
		},
		{
			name: 'folder-id',
			type: 'number',
			describe: 'ID of the folder to place the test case in.',
			schema: CreateTCaseShape.folderId,
		},
		{
			name: 'priority',
			type: 'string',
			describe: help.priority,
			choices: ['low', 'medium', 'high'] as const,
		},
		{
			name: 'precondition-text',
			type: 'string',
			describe: help['precondition-text'],
			schema: z.string().min(1),
			yargsOption: { conflicts: 'precondition-id' },
		},
		{
			name: 'precondition-id',
			type: 'number',
			describe: help['precondition-id'],
			schema: z.number().int().positive(),
			yargsOption: { conflicts: 'precondition-text' },
		},
		{ name: 'tags', type: 'string', describe: help.tags },
		{ name: 'is-draft', type: 'boolean', describe: help['is-draft'] },
		{
			name: 'steps',
			type: 'string',
			describe: help.steps,
			schema: StepsArraySchema,
			jsonParse: true,
		},
		{
			name: 'custom-fields',
			type: 'string',
			describe: help['custom-fields'],
			schema: customFieldsSchema,
			jsonParse: true,
		},
		{
			name: 'parameter-values',
			type: 'string',
			describe: help['parameter-values'],
			schema: z.array(parameterValueSchema),
			jsonParse: true,
		},
	],
	transformFields: transformTCaseFields,
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testCases.create(
				pathParams['project-code'],
				body as Parameters<typeof api.testCases.create>[1]
			)
		)
	},
}

const tcaseUpdate: ApiEndpointSpec = {
	id: 'test-cases.update',
	commandPath: ['test-cases', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [
		projectCodeParam,
		{ name: 'tcase-id', type: 'string', describe: help['tcase-id'], schema: resourceIdSchema },
	],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: UpdateTCaseRequestSchema.shape.title.unwrap(),
		},
		{
			name: 'priority',
			type: 'string',
			describe: help.priority,
			choices: ['low', 'medium', 'high'] as const,
		},
		{
			name: 'precondition-text',
			type: 'string',
			describe: help['precondition-text'],
			schema: z.string().min(1),
			yargsOption: { conflicts: 'precondition-id' },
		},
		{
			name: 'precondition-id',
			type: 'number',
			describe: help['precondition-id'],
			schema: z.number().int().positive(),
			yargsOption: { conflicts: 'precondition-text' },
		},
		{ name: 'tags', type: 'string', describe: help.tags },
		{ name: 'is-draft', type: 'boolean', describe: help['is-draft'] },
		{
			name: 'steps',
			type: 'string',
			describe: help.steps,
			schema: StepsArraySchema,
			jsonParse: true,
		},
		{
			name: 'custom-fields',
			type: 'string',
			describe: help['custom-fields'],
			schema: customFieldsSchema,
			jsonParse: true,
		},
		{
			name: 'parameter-values',
			type: 'string',
			describe:
				'JSON array of parameter value sets. Include tcaseId to modify existing filled cases.',
			schema: z.array(parameterValueWithIdSchema),
			jsonParse: true,
		},
	],
	transformFields: transformTCaseFields,
	check: (argv) => {
		const updateFields = [
			'title',
			'priority',
			'precondition-text',
			'precondition-id',
			'is-draft',
			'tags',
			'steps',
			'custom-fields',
			'parameter-values',
		]
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
			await api.testCases.update(
				pathParams['project-code'],
				pathParams['tcase-id'],
				body as Parameters<typeof api.testCases.update>[2]
			)
		)
	},
}

export const testCaseSpecs: ApiEndpointSpec[] = [list, get, count, tcaseCreate, tcaseUpdate]
