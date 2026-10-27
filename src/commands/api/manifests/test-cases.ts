import { z } from 'zod'
import {
	CreateTCaseRequestSchema,
	UpdateTCaseRequestSchema,
	StepsArraySchema,
	MoveTCaseItemsSchema,
	RequirementRefsSchema,
	customFieldsSchema,
	parameterValueSchema,
	parameterValueWithIdSchema,
	type ListTCasesRequest,
	type CountTCasesRequest,
	type CopyTCasesRequest,
	type DeleteTCasesRequest,
	type ListTCaseResultsRequest,
	type MoveTCasesRequest,
	type UpdateTCasesPriorityRequest,
	type UpdateTCasesRequirementsRequest,
	type UpdateTCasesTagsRequest,
} from '../../../api/tcases'
import { resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	idListSchema,
	intIdParam,
	paginationOptions,
	projectCodeParam,
	splitList,
} from './utils'
import type { ApiEndpointSpec, ApiFieldSpec, ApiPathParamSpec } from '../types'

// CreateTCaseRequestSchema stays a ZodObject despite its .superRefine() refinement,
// so its field definitions are available directly via .shape.
const CreateTCaseShape = CreateTCaseRequestSchema.shape

const help = {
	...commonHelp,
	'tcase-id': 'Test case ID.',
	title: 'Test case title, 1-511 characters.',
	priority: 'Priority level, low/medium/high.',
	'precondition-text':
		'Precondition text (supports HTML). Mutually exclusive with --precondition-id.',
	'precondition-id': 'Shared precondition ID. Mutually exclusive with --precondition-text.',
	tags: 'Comma-separated tag names (e.g., "smoke,regression"). On update, --tags "" clears all tags.',
	'is-draft': 'Whether the test case is a draft.',
	draft: 'Filter by draft status (true or false).',
	steps:
		'JSON array of step objects, each with "description", "expected" and optional test "data" (or a "sharedStepId"). On update it replaces the current steps, so send each step\'s data to keep it.\nExample: \'[{"description": "Click login", "expected": "Page loads"}]\'',
	'custom-fields':
		'JSON object mapping custom field keys to values.\nExample: \'{"field1": {"isDefault": false, "value": "some value"}}\'',
	'parameter-values':
		'JSON array of parameter value sets.\nExample: \'[{"values": {"browser": "Chrome"}}]\'',
	pos: 'Position in the folder, 0-based.',
	requirements:
		'JSON array of requirements, each with "text" and "url". On update it replaces the current list.\nExample: \'[{"text": "REQ-1", "url": "https://example.com/req/1"}]\'',
	links:
		'JSON array of links, each with "text" and "url". On update it replaces the current list.\nExample: \'[{"text": "Spec", "url": "https://example.com/spec"}]\'',
	files:
		'JSON array of files to attach, each with "id" and "url" from `files upload` plus "fileName", "mimeType" and "size". On update it replaces the current list.\nExample: \'[{"id": "1CfK...", "url": "https://...", "fileName": "log.txt", "mimeType": "text/plain", "size": 120}]\'',
	'title-suffix-params':
		'Comma-separated template parameters whose values are appended to the titles of its filled test cases (e.g., "browser,device"). Template test cases only.',
	folders: 'Comma-separated folder IDs to filter by (e.g., "1,2,3").',
	tagsFilter: 'Comma-separated tag IDs to filter by (e.g., "1,2,3").',
	priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
	'tcase-ids':
		'Comma-separated test case references: IDs, sequence numbers or legacy IDs (e.g., "12,13").',
	'tcase-version': 'Test case version number.',
	'target-folder-id': 'ID of the folder to copy the test cases into.',
	'source-project-id':
		'Code or ID of the project the test cases are copied from. Defaults to --project-code.',
	'new-parent-id': 'ID of the folder to move the test cases into.',
	items:
		'JSON array of the test cases to move, each with its final 0-based position in the folder (a negative pos counts from the end).\nExample: \'[{"id": "12", "pos": 0}, {"id": "13", "pos": -1}]\'',
	'add-tags': 'Comma-separated tag titles to add (missing tags are created).',
	'remove-tags': 'Comma-separated tag titles to remove. A title also in --add is kept.',
	'add-requirements':
		'JSON array of requirements to link (missing ones are created).\nExample: \'[{"text": "REQ-1", "url": "https://example.com/req/1"}]\'',
	'remove-requirements':
		'JSON array of requirements to unlink, matched by text and url. One also in --add is kept.',
	include: 'Comma-separated related data to include.',
	'created-after': 'Only results created after this time (RFC 3339, e.g., "2026-01-01T00:00:00Z").',
	'exclude-status': 'Comma-separated result statuses to leave out (e.g., "open,skipped").',
	internal: 'Set to false to leave out system results, such as the reset to open after an edit.',
	list: {
		describe: 'List test cases in a project.',
		epilog: apiDocsEpilog('tcases', 'list-test-cases'),
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
	delete: {
		describe:
			'Delete test cases. They go to the trash as one entry, which the response describes; its id restores them.',
		epilog: apiDocsEpilog('tcases', 'delete-test-cases'),
		examples: [
			{
				usage: '$0 api test-cases delete --project-code PRJ --tcase-ids 12,13',
				description: 'Delete two test cases by sequence number',
			},
		],
	},
	copy: {
		describe: 'Copy test cases into a folder, optionally from another project.',
		epilog: apiDocsEpilog('tcases', 'copy-test-cases'),
		examples: [
			{
				usage: '$0 api test-cases copy --project-code PRJ --tcase-ids 12,13 --target-folder-id 5',
				description: 'Copy test cases within a project',
			},
			{
				usage:
					'$0 api test-cases copy --project-code PRJ --tcase-ids 4 --target-folder-id 5 --source-project-id OLD',
				description: 'Copy a test case from another project',
			},
		],
	},
	move: {
		describe:
			'Move test cases to a folder, or reorder them within their folder. Moves are not versioned.',
		epilog: apiDocsEpilog('tcases', 'move-test-cases'),
		examples: [
			{
				usage:
					'$0 api test-cases move --project-code PRJ --new-parent-id 5 --items \'[{"id": "12", "pos": 0}, {"id": "13", "pos": 1}]\'',
				description: 'Move two test cases to the top of a folder',
			},
		],
	},
	updatePriority: {
		describe: 'Set the priority of several test cases. Each changed test case gets a new version.',
		epilog: apiDocsEpilog('tcases', 'update-test-case-priority'),
		examples: [
			{
				usage:
					'$0 api test-cases update-priority --project-code PRJ --tcase-ids 12,13 --priority high',
				description: 'Raise the priority of two test cases',
			},
		],
	},
	updateTags: {
		describe:
			'Add tags to and remove tags from several test cases, keeping their other tags. Each changed test case gets a new version.',
		epilog: apiDocsEpilog('tcases', 'update-test-case-tags'),
		examples: [
			{
				usage:
					'$0 api test-cases update-tags --project-code PRJ --tcase-ids 12,13 --add smoke --remove flaky',
				description: 'Tag two test cases as smoke and drop the flaky tag',
			},
		],
	},
	updateRequirements: {
		describe:
			'Link requirements to and unlink them from several test cases, keeping their other requirements. Each changed test case gets a new version.',
		epilog: apiDocsEpilog('tcases', 'update-test-case-requirements'),
		examples: [
			{
				usage:
					'$0 api test-cases update-requirements --project-code PRJ --tcase-ids 12 --add \'[{"text": "REQ-1"}]\'',
				description: 'Link a requirement to a test case',
			},
		],
	},
	getVersion: {
		describe: 'Get an earlier version of a test case.',
		epilog: apiDocsEpilog('tcases', 'get-test-case-version'),
		examples: [
			{
				usage: '$0 api test-cases get-version --project-code PRJ --tcase-id 12 --tcase-version 2',
				description: 'Get version 2 of a test case',
			},
		],
	},
	rollback: {
		describe:
			'Roll a test case back to an earlier version, saved as a new version. The folder and position stay as they are.',
		epilog: apiDocsEpilog('tcases', 'roll-back-test-case'),
		examples: [
			{
				usage: '$0 api test-cases rollback --project-code PRJ --tcase-id 12 --tcase-version 2',
				description: 'Restore the content of version 2',
			},
		],
	},
	resultsList: {
		describe: 'List the results of a test case across all runs, most recent first.',
		epilog: apiDocsEpilog('tcases', 'list-test-case-results'),
		examples: [
			{
				usage: '$0 api test-cases results list --project-code PRJ --tcase-id 12 --include run',
				description: 'List the results of a test case with their runs',
			},
		],
	},
} as const

const tcaseIdParam: ApiPathParamSpec = {
	name: 'tcase-id',
	type: 'string',
	describe: help['tcase-id'],
	schema: resourceIdSchema,
}

const tcaseVersionParam = intIdParam('tcase-version', help['tcase-version'])

const tcaseIdsField: ApiFieldSpec = {
	name: 'tcase-ids',
	type: 'string',
	describe: help['tcase-ids'],
	schema: idListSchema,
}

/** Allows a JSON-body command to run when its required fields are set, or --body/--body-file is. */
const requireFieldsOrBody =
	(...fields: string[]) =>
	(argv: Record<string, unknown>): true | string =>
		argv.body !== undefined ||
		argv['body-file'] !== undefined ||
		fields.every((f) => argv[f] !== undefined)
			? true
			: `Either --body, --body-file, or ${fields.map((f) => `--${f}`).join(' and ')} is required`

const list: ApiEndpointSpec = {
	id: 'test-cases.list',
	commandPath: ['test-cases', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		...paginationOptions([
			'id',
			'seq',
			'folder_id',
			'author_id',
			'pos',
			'title',
			'priority',
			'created_at',
			'updated_at',
			'legacy_id',
		]),
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
		{
			name: 'include',
			type: 'string',
			describe: 'Comma-separated additional fields to include.',
			helpChoices: [
				'precondition',
				'steps',
				'tags',
				'requirements',
				'customFields',
				'filterableCustomFields',
				'parameterValues',
				'folder',
				'path',
				'project',
			],
		},
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
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
		...kebabToCamelCaseKeys(query),
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
	const result = kebabToCamelCaseKeys(fields)

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
		result.tags = fields.tags
			.split(',')
			.map((tag) => tag.trim())
			.filter((tag) => !!tag)
	}

	if (fields['title-suffix-params'] !== undefined) {
		result.filledTCaseTitleSuffixParams = splitList(fields['title-suffix-params'])
	}
	delete result.titleSuffixParams

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
		{ name: 'title-suffix-params', type: 'string', describe: help['title-suffix-params'] },
		{ name: 'pos', type: 'number', describe: help.pos, schema: CreateTCaseShape.pos.unwrap() },
		{
			name: 'requirements',
			type: 'string',
			describe: help.requirements,
			schema: CreateTCaseShape.requirements.unwrap(),
			jsonParse: true,
		},
		{
			name: 'links',
			type: 'string',
			describe: help.links,
			schema: CreateTCaseShape.links.unwrap(),
			jsonParse: true,
		},
		{
			name: 'files',
			type: 'string',
			describe: help.files,
			schema: CreateTCaseShape.files.unwrap(),
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
		{ name: 'title-suffix-params', type: 'string', describe: help['title-suffix-params'] },
		{
			name: 'requirements',
			type: 'string',
			describe: help.requirements,
			schema: UpdateTCaseRequestSchema.shape.requirements.unwrap(),
			jsonParse: true,
		},
		{
			name: 'links',
			type: 'string',
			describe: help.links,
			schema: UpdateTCaseRequestSchema.shape.links.unwrap(),
			jsonParse: true,
		},
		{
			name: 'files',
			type: 'string',
			describe: help.files,
			schema: UpdateTCaseRequestSchema.shape.files.unwrap(),
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
			'title-suffix-params',
			'requirements',
			'links',
			'files',
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

const tcaseDelete: ApiEndpointSpec = {
	id: 'test-cases.delete',
	commandPath: ['test-cases', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [tcaseIdsField],
	transformFields: (fields) => ({ tcaseIds: splitList(fields['tcase-ids']) }),
	check: requireFieldsOrBody('tcase-ids'),
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await api.testCases.delete(pathParams['project-code'], body as DeleteTCasesRequest))
	},
}

const tcaseCopy: ApiEndpointSpec = {
	id: 'test-cases.copy',
	commandPath: ['test-cases', 'copy'],
	describe: help.copy.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		tcaseIdsField,
		{
			name: 'target-folder-id',
			type: 'number',
			describe: help['target-folder-id'],
			schema: z.number().int().positive('must be a positive integer'),
		},
		{
			name: 'source-project-id',
			type: 'string',
			describe: help['source-project-id'],
			schema: resourceIdSchema,
		},
	],
	transformFields: (fields) => ({
		...kebabToCamelCaseKeys(fields),
		tcaseIds: splitList(fields['tcase-ids']),
	}),
	check: requireFieldsOrBody('tcase-ids', 'target-folder-id'),
	epilog: help.copy.epilog,
	examples: help.copy.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await api.testCases.copy(pathParams['project-code'], body as CopyTCasesRequest))
	},
}

const tcaseMove: ApiEndpointSpec = {
	id: 'test-cases.move',
	commandPath: ['test-cases', 'move'],
	describe: help.move.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'new-parent-id',
			type: 'number',
			describe: help['new-parent-id'],
			schema: z.number().int().positive('must be a positive integer'),
		},
		{
			name: 'items',
			type: 'string',
			describe: help.items,
			schema: MoveTCaseItemsSchema,
			jsonParse: true,
		},
	],
	check: requireFieldsOrBody('new-parent-id', 'items'),
	epilog: help.move.epilog,
	examples: help.move.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await api.testCases.move(pathParams['project-code'], body as MoveTCasesRequest))
	},
}

const tcaseUpdatePriority: ApiEndpointSpec = {
	id: 'test-cases.update-priority',
	commandPath: ['test-cases', 'update-priority'],
	describe: help.updatePriority.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		tcaseIdsField,
		{
			name: 'priority',
			type: 'string',
			describe: help.priority,
			choices: ['low', 'medium', 'high'] as const,
		},
	],
	transformFields: (fields) => ({
		...kebabToCamelCaseKeys(fields),
		tcaseIds: splitList(fields['tcase-ids']),
	}),
	check: requireFieldsOrBody('tcase-ids', 'priority'),
	epilog: help.updatePriority.epilog,
	examples: help.updatePriority.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testCases.updatePriority(
				pathParams['project-code'],
				body as UpdateTCasesPriorityRequest
			)
		)
	},
}

/** Like requireFieldsOrBody('tcase-ids'), but also needs at least one of --add and --remove. */
const requireTCaseIdsAndChange = (argv: Record<string, unknown>): true | string => {
	if (argv.body !== undefined || argv['body-file'] !== undefined) return true
	if (argv['tcase-ids'] === undefined)
		return 'Either --body, --body-file, or --tcase-ids is required'
	if (argv.add === undefined && argv.remove === undefined)
		return 'Either --add or --remove is required'
	return true
}

const tcaseUpdateTags: ApiEndpointSpec = {
	id: 'test-cases.update-tags',
	commandPath: ['test-cases', 'update-tags'],
	describe: help.updateTags.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		tcaseIdsField,
		{ name: 'add', type: 'string', describe: help['add-tags'] },
		{ name: 'remove', type: 'string', describe: help['remove-tags'] },
	],
	transformFields: (fields) => ({
		tcaseIds: splitList(fields['tcase-ids']),
		add: splitList(fields.add),
		remove: splitList(fields.remove),
	}),
	check: requireTCaseIdsAndChange,
	epilog: help.updateTags.epilog,
	examples: help.updateTags.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testCases.updateTags(pathParams['project-code'], body as UpdateTCasesTagsRequest)
		)
	},
}

const tcaseUpdateRequirements: ApiEndpointSpec = {
	id: 'test-cases.update-requirements',
	commandPath: ['test-cases', 'update-requirements'],
	describe: help.updateRequirements.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		tcaseIdsField,
		{
			name: 'add',
			type: 'string',
			describe: help['add-requirements'],
			schema: RequirementRefsSchema,
			jsonParse: true,
		},
		{
			name: 'remove',
			type: 'string',
			describe: help['remove-requirements'],
			schema: RequirementRefsSchema,
			jsonParse: true,
		},
	],
	transformFields: (fields) => ({
		tcaseIds: splitList(fields['tcase-ids']),
		add: fields.add,
		remove: fields.remove,
	}),
	check: requireTCaseIdsAndChange,
	epilog: help.updateRequirements.epilog,
	examples: help.updateRequirements.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testCases.updateRequirements(
				pathParams['project-code'],
				body as UpdateTCasesRequirementsRequest
			)
		)
	},
}

const tcaseGetVersion: ApiEndpointSpec = {
	id: 'test-cases.get-version',
	commandPath: ['test-cases', 'get-version'],
	describe: help.getVersion.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, tcaseIdParam, tcaseVersionParam],
	epilog: help.getVersion.epilog,
	examples: help.getVersion.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.testCases.getVersion(
				pathParams['project-code'],
				pathParams['tcase-id'],
				pathParams['tcase-version'] as number
			)
		)
	},
}

const tcaseRollback: ApiEndpointSpec = {
	id: 'test-cases.rollback',
	commandPath: ['test-cases', 'rollback'],
	describe: help.rollback.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, tcaseIdParam, tcaseVersionParam],
	epilog: help.rollback.epilog,
	examples: help.rollback.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.testCases.rollback(
				pathParams['project-code'],
				pathParams['tcase-id'],
				pathParams['tcase-version'] as number
			)
		)
	},
}

const tcaseResultsList: ApiEndpointSpec = {
	id: 'test-cases.results.list',
	commandPath: ['test-cases', 'results', 'list'],
	describe: help.resultsList.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, tcaseIdParam],
	queryOptions: [
		...paginationOptions(['created_at']),
		{
			name: 'include',
			type: 'string',
			describe: help.include,
			helpChoices: ['run', 'links', 'author'],
		},
		{ name: 'created-after', type: 'string', describe: help['created-after'] },
		{ name: 'exclude-status', type: 'string', describe: help['exclude-status'] },
		{ name: 'internal', type: 'boolean', describe: help.internal },
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		include: splitList(query.include),
		excludeStatus: splitList(query['exclude-status']),
	}),
	epilog: help.resultsList.epilog,
	examples: help.resultsList.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.testCases.listResults(
				pathParams['project-code'],
				pathParams['tcase-id'],
				query as ListTCaseResultsRequest
			)
		)
	},
}

export const testCaseSpecs: ApiEndpointSpec[] = [
	list,
	get,
	count,
	tcaseCreate,
	tcaseUpdate,
	tcaseDelete,
	tcaseCopy,
	tcaseMove,
	tcaseUpdatePriority,
	tcaseUpdateTags,
	tcaseUpdateRequirements,
	tcaseGetVersion,
	tcaseRollback,
	tcaseResultsList,
]
