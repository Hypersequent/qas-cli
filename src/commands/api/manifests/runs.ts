import { z } from 'zod'
import type { Api } from '../../../api/index'
import {
	CreateRunRequestSchema,
	CreateRunLogRequestSchema,
	QueryPlansSchema,
	CloneRunRequestSchema,
	MoveRunsRequestSchema,
	PreviewRunTCasesRequestSchema,
	UpdateRunRequestSchema,
	type ListAssignedRunsRequest,
	type ListRunLogsRequest,
	type ListRunsRequest,
	type ListRunTCasesRequest,
	type MoveRunsRequest,
	type PreviewRunTCasesRequest,
	type RunIdsRequest,
	type RunTCaseFilters,
	type UpdateRunRequest,
	type UpdateRunTCaseVersionRequest,
	CreateRunLogRequest,
} from '../../../api/runs'
import { filterOpEnum, limitParam, offsetParam, resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	intListSchema,
	paginationOptions,
	projectCodeParam,
	requireAnyFieldOrBody,
	requireFieldsOrBody,
	splitIntList,
	splitList,
} from './utils'
import type { ApiEndpointSpec, ApiFieldSpec, ApiQueryOptionSpec } from '../types'

// CreateRunRequestSchema stays a ZodObject despite its .superRefine() refinement,
// so its field definitions are available directly via .shape.
const CreateRunShape = CreateRunRequestSchema.shape
const UpdateRunShape = UpdateRunRequestSchema.shape
const PreviewShape = PreviewRunTCasesRequestSchema.shape

const help = {
	...commonHelp,
	'run-id': 'Test run ID.',
	'tcase-id': 'Test case ID, sequence number or legacy ID.',
	title: 'Display title for the test run, 1-255 characters.',
	type: 'Run type: static, static_struct, or live.',
	description: 'Optional description for the test run (supports HTML).',
	'milestone-id': 'ID of the milestone to associate with this run.',
	'configuration-id': 'ID of the configuration to associate with this run.',
	'assignment-id': 'ID of the user to assign to this run.',
	'query-plans':
		'JSON array of query plans that select the test cases of the run: one with "tcaseIds" (test case IDs, sequence numbers or legacy IDs), or one or more with filters ("folderIds", "tagIds", "priorities"). Live runs take filters only. A query plan with no fields selects no test cases, or every one on a live run.\nExample: \'[{"tcaseIds": ["4"]}]\'',
	closed: 'Filter by closed status. If true, returns only closed runs.',
	'milestone-ids': 'Comma-separated milestone IDs to filter by (e.g., "1,2,3").',
	'plan-ids': 'Comma-separated test plan IDs to filter by (e.g., "1,2").',
	'configuration-ids': 'Comma-separated configuration IDs to filter by.',
	search: 'Search text to filter test cases.',
	tags: 'Comma-separated tag IDs to filter by.',
	priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
	include: 'Comma-separated additional fields to include.',
	'run-include': 'Comma-separated related data to include.',
	comment: 'Log message body (supports HTML).',
	'integration-issue-id':
		"ID or key of an issue in the project's Jira or Linear integration to link the run to.",
	'run-ids': 'Comma-separated run IDs (e.g., "1,2"), at most 100.',
	'tags-filter-op':
		'How several --tags combine: or (any of them, the default), and (all) or not (none).',
	status:
		'Comma-separated statuses of the test case in the run: passed, failed, skipped, open, blocked or custom1-custom4.',
	'automation-results':
		'Comma-separated automated result filters: automated_passing (the latest automated result passed), automated_failing, has_automated or has_manual.',
	'automation-results-filter-op':
		'How several --automation-results combine: or (the default), and or not.',
	'update-type':
		'New run type: static, static_struct or live. Switching to or from live also needs --query-plans.',
	'update-description': 'Description of the test run (supports HTML).',
	'update-milestone-id': 'Milestone to move the run to; 0 takes it out of its milestone.',
	'update-assignment-id': 'User to assign the run to; 0 unassigns it.',
	'update-configuration-id': 'Configuration of the run; "" removes it.',
	'update-integration-issue-id':
		'Issue to link the run to in the project\'s Jira or Linear integration; "" removes the link.',
	'update-query-plans':
		'JSON array that replaces the whole selection of the run; a query plan left out is removed. A query plan sent with its "id" (see runs selections) is replaced by the fields sent with it, so send all its current fields to keep it. Test cases that stay keep their results.\nExample: \'[{"id": 3, "tagIds": [1]}, {"folderIds": [2]}]\'',
	'move-milestone-id': 'Milestone to move the runs to; 0 takes them out of their milestone.',
	'run-type': 'Run type to preview: static, static_struct, or live.',
	'preview-run-id':
		'An existing run, to preview a change to its selection: test cases it has keep their version and status.',
	'logs-sort-field':
		'Field to sort by; created_at by default. api_key_id groups the logs of each API key.',
	'assigned-sort-field':
		'Field to sort by; created_at by default. last_activity_at is the latest result or run log.',
	'update-to-latest-version':
		'Move the run test case to the latest version of its test case. Its status in the run goes back to open.',
	'allow-run-tcase-removal':
		"Live runs: remove the test case when its latest version no longer matches the run's filters.",
	get: {
		describe: 'Get a test run.',
		epilog: apiDocsEpilog('run', 'get-run'),
		examples: [
			{ usage: '$0 api runs get --project-code PRJ --run-id 1', description: 'Get a run' },
		],
	},
	update: {
		describe:
			'Update a test run. Fields left out keep their values. Runs of a test plan are updated with test-plans update-run, and a closed run must be reopened first.',
		epilog: apiDocsEpilog('run', 'update-run'),
		examples: [
			{
				usage:
					'$0 api runs update --project-code PRJ --run-id 1 --title "Sprint 2" --milestone-id 0',
				description: 'Rename a run and take it out of its milestone',
			},
		],
	},
	reopen: {
		describe:
			'Reopen a closed test run. It catches up with the changes made to its test cases while it was closed. Runs of a test plan are reopened with test-plans reopen.',
		epilog: apiDocsEpilog('run', 'reopen-run'),
		examples: [
			{ usage: '$0 api runs reopen --project-code PRJ --run-id 1', description: 'Reopen a run' },
		],
	},
	bulkClose: {
		describe:
			'Close several test runs. Runs already closed are left as they are. Runs of a test plan are closed with test-plans close.',
		epilog: apiDocsEpilog('run', 'close-runs'),
		examples: [
			{
				usage: '$0 api runs bulk-close --project-code PRJ --run-ids 1,2',
				description: 'Close two runs',
			},
		],
	},
	bulkReopen: {
		describe:
			'Reopen several test runs. Runs already open are left as they are. Runs of a test plan are reopened with test-plans reopen.',
		epilog: apiDocsEpilog('run', 'reopen-runs'),
		examples: [
			{
				usage: '$0 api runs bulk-reopen --project-code PRJ --run-ids 1,2',
				description: 'Reopen two runs',
			},
		],
	},
	move: {
		describe:
			'Move test runs into a milestone, or out of their milestone. Closed runs stay closed. Runs of a test plan move with it, using test-plans move.',
		epilog: apiDocsEpilog('run', 'move-runs-to-milestone'),
		examples: [
			{
				usage: '$0 api runs move --project-code PRJ --run-ids 1,2 --milestone-id 5',
				description: 'Move two runs into milestone 5',
			},
		],
	},
	delete: {
		describe:
			'Delete test runs. Each goes to the trash, closed, and can be restored with trash restore. Runs of a test plan are deleted with test-plans delete.',
		epilog: apiDocsEpilog('run', 'delete-runs'),
		examples: [
			{
				usage: '$0 api runs delete --project-code PRJ --run-ids 1,2',
				description: 'Delete two runs',
			},
		],
	},
	selections: {
		describe:
			"Get a run's selections (its query plans), to change one with runs update, which replaces them all.",
		epilog: apiDocsEpilog('run', 'get-run-selections'),
		examples: [
			{
				usage: '$0 api runs selections --project-code PRJ --run-id 1',
				description: "Get a run's query plans",
			},
		],
	},
	folders: {
		describe:
			"Get the folder tree of a run's test cases. With filters, only folders holding a matching test case.",
		epilog: apiDocsEpilog('run', 'get-run-folder-tree'),
		examples: [
			{
				usage: '$0 api runs folders --project-code PRJ --run-id 1 --status failed',
				description: 'Get the folders holding failed test cases',
			},
		],
	},
	statusCounts: {
		describe: "Count a run's test cases in each status, optionally only those matching filters.",
		epilog: apiDocsEpilog('run', 'get-run-status-counts'),
		examples: [
			{
				usage: '$0 api runs status-counts --project-code PRJ --run-id 1',
				description: "Count a run's test cases by status",
			},
		],
	},
	openStatusCounts: {
		describe: 'Get the status counts of every open run in a project.',
		epilog: apiDocsEpilog('run', 'get-status-counts-of-open-runs'),
		examples: [
			{
				usage: '$0 api runs open-status-counts --project-code PRJ',
				description: 'Get the status counts of open runs',
			},
		],
	},
	preview: {
		describe:
			'Preview the test cases a selection would put in a run, without creating or changing one.',
		epilog: apiDocsEpilog('run', 'preview-run-test-cases'),
		examples: [
			{
				usage:
					'$0 api runs preview --project-code PRJ --run-type live --query-plans \'[{"tagIds": [1]}]\'',
				description: 'Preview a live run filtered by tag',
			},
		],
	},
	listAssigned: {
		describe:
			'List the open runs assigned to you, across every project you can access, leaving out archived projects.',
		epilog: apiDocsEpilog('run', 'list-runs-assigned-to-me'),
		examples: [
			{ usage: '$0 api runs list-assigned', description: 'List the open runs assigned to you' },
		],
	},
	logsList: {
		describe: "List a run's logs, such as CI/CD output added with runs logs create.",
		epilog: apiDocsEpilog('run', 'list-run-logs'),
		examples: [
			{
				usage: '$0 api runs logs list --project-code PRJ --run-id 1',
				description: "List a run's logs",
			},
		],
	},
	tcasesUpdateVersion: {
		describe: 'Move a run test case to the latest version of its test case.',
		epilog: apiDocsEpilog('run', 'update-run-test-case-version'),
		examples: [
			{
				usage:
					'$0 api runs test-cases update-version --project-code PRJ --run-id 1 --tcase-id 12 --update-to-latest-version',
				description: 'Move a run test case to the latest version',
			},
		],
	},
	create: {
		describe: 'Create a new test run.',
		epilog: apiDocsEpilog('run', 'create-new-run'),
		examples: [
			{
				usage:
					'$0 api runs create --project-code PRJ --title "Sprint 1" --type static --query-plans \'[{"tcaseIds": ["4"]}]\'',
				description: 'Create a static run with specific test cases',
			},
			{
				usage:
					'$0 api runs create --project-code PRJ --body \'{"title": "Sprint 1", "type": "static", "queryPlans": [{"tcaseIds": ["4"]}]}\'',
				description: 'Create a run using --body',
			},
		],
	},
	list: {
		describe: 'List test runs in a project.',
		epilog: apiDocsEpilog('run', 'list-runs'),
		examples: [
			{
				usage: '$0 api runs list --project-code PRJ',
				description: 'List test runs in a project',
			},
			{
				usage: '$0 api runs list --project-code PRJ --closed false --include statusCounts',
				description: 'List open runs with their result counts',
			},
		],
	},
	clone: {
		describe:
			"Clone an existing test run: its type and test case selection. Other fields come only from the request, so the source run's milestone, configuration and assignee are not copied.",
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
		describe: 'Close a test run. Runs of a test plan are closed with test-plans close.',
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
	logsCreate: {
		describe:
			'Append a run-level log message (e.g. CI/CD or automation framework output) to a test run.',
		epilog: apiDocsEpilog('run', 'create-run-log'),
		examples: [
			{
				usage: '$0 api runs logs create --project-code PRJ --run-id 1 --comment "Deploy finished"',
				description: 'Create a run log with --comment',
			},
			{
				usage:
					'$0 api runs logs create --project-code PRJ --run-id 1 --body \'{"comment": "Deploy finished"}\'',
				description: 'Create a run log using --body',
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

const runTCaseIdParam = {
	name: 'tcase-id',
	type: 'string' as const,
	describe: help['tcase-id'],
	schema: resourceIdSchema,
}

const runIdsField: ApiFieldSpec = {
	name: 'run-ids',
	type: 'string',
	describe: help['run-ids'],
	schema: intListSchema,
}

// Filters of a run's test cases, shared by their list, folder tree and status counts.
const runTCaseFilterOptions: ApiQueryOptionSpec[] = [
	{ name: 'search', type: 'string', describe: help.search },
	{ name: 'tags', type: 'string', describe: help.tags },
	{
		name: 'tags-filter-op',
		type: 'string',
		describe: help['tags-filter-op'],
		choices: filterOpEnum.options,
	},
	{ name: 'priorities', type: 'string', describe: help.priorities },
	{ name: 'status', type: 'string', describe: help.status },
	{ name: 'automation-results', type: 'string', describe: help['automation-results'] },
	{
		name: 'automation-results-filter-op',
		type: 'string',
		describe: help['automation-results-filter-op'],
		choices: filterOpEnum.options,
	},
]

const transformRunTCaseFilters = (query: Record<string, unknown>) => ({
	...kebabToCamelCaseKeys(query),
	tags: splitIntList(query.tags),
	priorities: splitList(query.priorities),
	status: splitList(query.status),
	automationResults: splitList(query['automation-results']),
})

const updateFieldNames = [
	'title',
	'description',
	'type',
	'milestone-id',
	'assignment-id',
	'configuration-id',
	'integration-issue-id',
	'query-plans',
]

const runIdsSpec = (
	action: 'bulk-close' | 'bulk-reopen' | 'delete',
	text: { describe: string; epilog: string; examples: ApiEndpointSpec['examples'] },
	call: (api: Api, projectCode: string | number, req: RunIdsRequest) => Promise<unknown>
): ApiEndpointSpec => ({
	id: `runs.${action}`,
	commandPath: ['runs', action],
	describe: text.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [runIdsField],
	transformFields: (fields) => ({ runIds: splitIntList(fields['run-ids']) }),
	check: requireFieldsOrBody('run-ids'),
	epilog: text.epilog,
	examples: text.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await call(api, pathParams['project-code'], body as RunIdsRequest))
	},
})

const list: ApiEndpointSpec = {
	id: 'runs.list',
	commandPath: ['runs', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'closed', type: 'boolean', describe: help.closed },
		{ name: 'milestone-ids', type: 'string', describe: help['milestone-ids'] },
		{ name: 'plan-ids', type: 'string', describe: help['plan-ids'], schema: intListSchema },
		{ name: 'configuration-ids', type: 'string', describe: help['configuration-ids'] },
		{
			name: 'include',
			type: 'string',
			describe: help['run-include'],
			helpChoices: ['project', 'plan', 'milestone', 'assignment', 'configuration', 'statusCounts'],
		},
		...paginationOptions(['title', 'created_at', 'last_activity_at', 'closed_at']),
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		milestoneIds:
			typeof query['milestone-ids'] === 'string'
				? query['milestone-ids'].split(',').map(Number)
				: query['milestone-ids'],
		planIds: splitIntList(query['plan-ids']),
		configurationIds: splitList(query['configuration-ids']),
		include: splitList(query.include),
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.runs.list(pathParams['project-code'], query as ListRunsRequest))
	},
}

const listAssigned: ApiEndpointSpec = {
	id: 'runs.list-assigned',
	commandPath: ['runs', 'list-assigned'],
	describe: help.listAssigned.describe,
	bodyMode: 'none',
	pathParams: [],
	queryOptions: paginationOptions(
		['title', 'created_at', 'last_activity_at'],
		help['assigned-sort-field']
	),
	epilog: help.listAssigned.epilog,
	examples: help.listAssigned.examples,
	execute: async (api, { query }) => {
		printJson(await api.runs.listAssigned(query as ListAssignedRunsRequest))
	},
}

const openStatusCounts: ApiEndpointSpec = {
	id: 'runs.open-status-counts',
	commandPath: ['runs', 'open-status-counts'],
	describe: help.openStatusCounts.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	epilog: help.openStatusCounts.epilog,
	examples: help.openStatusCounts.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.runs.getOpenStatusCounts(pathParams['project-code']))
	},
}

const get: ApiEndpointSpec = {
	id: 'runs.get',
	commandPath: ['runs', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.runs.get(pathParams['project-code'], pathParams['run-id']))
	},
}

const selections: ApiEndpointSpec = {
	id: 'runs.selections',
	commandPath: ['runs', 'selections'],
	describe: help.selections.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	epilog: help.selections.epilog,
	examples: help.selections.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.runs.getSelections(pathParams['project-code'], pathParams['run-id']))
	},
}

const folders: ApiEndpointSpec = {
	id: 'runs.folders',
	commandPath: ['runs', 'folders'],
	describe: help.folders.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	queryOptions: runTCaseFilterOptions,
	transformQuery: transformRunTCaseFilters,
	epilog: help.folders.epilog,
	examples: help.folders.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.runs.getFolderTree(
				pathParams['project-code'],
				pathParams['run-id'],
				query as RunTCaseFilters
			)
		)
	},
}

const statusCounts: ApiEndpointSpec = {
	id: 'runs.status-counts',
	commandPath: ['runs', 'status-counts'],
	describe: help.statusCounts.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	queryOptions: runTCaseFilterOptions,
	transformQuery: transformRunTCaseFilters,
	epilog: help.statusCounts.epilog,
	examples: help.statusCounts.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.runs.getStatusCounts(
				pathParams['project-code'],
				pathParams['run-id'],
				query as RunTCaseFilters
			)
		)
	},
}

const preview: ApiEndpointSpec = {
	id: 'runs.preview',
	commandPath: ['runs', 'preview'],
	describe: help.preview.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'run-type',
			type: 'string',
			describe: help['run-type'],
			choices: ['static', 'static_struct', 'live'],
		},
		{
			name: 'query-plans',
			type: 'string',
			describe: help['query-plans'],
			schema: QueryPlansSchema,
			jsonParse: true,
		},
		{
			name: 'run-id',
			type: 'number',
			describe: help['preview-run-id'],
			schema: PreviewShape.runId.unwrap(),
		},
		{ name: 'offset', type: 'number', describe: help.offset, schema: offsetParam },
		{ name: 'limit', type: 'number', describe: help.limit, schema: limitParam },
	],
	check: requireFieldsOrBody('run-type', 'query-plans'),
	epilog: help.preview.epilog,
	examples: help.preview.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.runs.previewTCases(pathParams['project-code'], body as PreviewRunTCasesRequest)
		)
	},
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
			name: 'integration-issue-id',
			type: 'string',
			describe: help['integration-issue-id'],
			schema: CreateRunShape.integrationIssueId.unwrap(),
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
			name: 'configuration-id',
			type: 'string',
			describe: 'Configuration ID for the cloned run.',
			schema: CloneRunRequestSchema.shape.configurationId.unwrap(),
		},
		{
			name: 'assignment-id',
			type: 'number',
			describe: 'Assignment ID for the cloned run.',
			schema: CloneRunRequestSchema.shape.assignmentId.unwrap(),
		},
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: help['integration-issue-id'],
			schema: CloneRunRequestSchema.shape.integrationIssueId.unwrap(),
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

const update: ApiEndpointSpec = {
	id: 'runs.update',
	commandPath: ['runs', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, runIdParam],
	fieldOptions: [
		{ name: 'title', type: 'string', describe: help.title, schema: UpdateRunShape.title.unwrap() },
		{ name: 'description', type: 'string', describe: help['update-description'] },
		{
			name: 'type',
			type: 'string',
			describe: help['update-type'],
			choices: ['static', 'static_struct', 'live'],
		},
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['update-milestone-id'],
			schema: UpdateRunShape.milestoneId.unwrap(),
		},
		{
			name: 'assignment-id',
			type: 'number',
			describe: help['update-assignment-id'],
			schema: UpdateRunShape.assignmentId.unwrap(),
		},
		{ name: 'configuration-id', type: 'string', describe: help['update-configuration-id'] },
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: help['update-integration-issue-id'],
			schema: UpdateRunShape.integrationIssueId.unwrap(),
		},
		{
			name: 'query-plans',
			type: 'string',
			describe: help['update-query-plans'],
			schema: UpdateRunShape.queryPlans.unwrap(),
			jsonParse: true,
		},
	],
	check: requireAnyFieldOrBody(...updateFieldNames),
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.runs.update(
				pathParams['project-code'],
				pathParams['run-id'],
				body as UpdateRunRequest
			)
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

const reopen: ApiEndpointSpec = {
	id: 'runs.reopen',
	commandPath: ['runs', 'reopen'],
	describe: help.reopen.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	epilog: help.reopen.epilog,
	examples: help.reopen.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.runs.reopen(pathParams['project-code'], pathParams['run-id']))
	},
}

const bulkClose = runIdsSpec('bulk-close', help.bulkClose, (api, code, req) =>
	api.runs.closeMany(code, req)
)

const bulkReopen = runIdsSpec('bulk-reopen', help.bulkReopen, (api, code, req) =>
	api.runs.reopenMany(code, req)
)

const move: ApiEndpointSpec = {
	id: 'runs.move',
	commandPath: ['runs', 'move'],
	describe: help.move.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		runIdsField,
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['move-milestone-id'],
			schema: MoveRunsRequestSchema.shape.milestoneId,
		},
	],
	transformFields: (fields) => ({
		runIds: splitIntList(fields['run-ids']),
		milestoneId: fields['milestone-id'],
	}),
	check: requireFieldsOrBody('run-ids', 'milestone-id'),
	epilog: help.move.epilog,
	examples: help.move.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await api.runs.moveToMilestone(pathParams['project-code'], body as MoveRunsRequest))
	},
}

const remove = runIdsSpec('delete', help.delete, (api, code, req) => api.runs.deleteMany(code, req))

const tcasesList: ApiEndpointSpec = {
	id: 'runs.tcases.list',
	commandPath: ['runs', 'test-cases', 'list'],
	describe: help.tcasesList.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	queryOptions: [
		...runTCaseFilterOptions,
		{
			name: 'include',
			type: 'string',
			describe: help.include,
			helpChoices: ['folder', 'steps', 'tags', 'precondition', 'requirements', 'customFields'],
		},
		...paginationOptions(['seq', 'folder_id', 'pos', 'title', 'priority', 'status']),
	],
	transformQuery: (query) => ({
		...transformRunTCaseFilters(query),
		include: splitList(query.include),
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
	pathParams: [projectCodeParam, runIdParam, runTCaseIdParam],
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

const tcasesUpdateVersion: ApiEndpointSpec = {
	id: 'runs.tcases.update-version',
	commandPath: ['runs', 'test-cases', 'update-version'],
	describe: help.tcasesUpdateVersion.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, runIdParam, runTCaseIdParam],
	fieldOptions: [
		{
			name: 'update-to-latest-version',
			type: 'boolean',
			describe: help['update-to-latest-version'],
		},
		{ name: 'allow-run-tcase-removal', type: 'boolean', describe: help['allow-run-tcase-removal'] },
	],
	// kebab-to-camel would give allowRunTcaseRemoval.
	transformFields: ({ 'allow-run-tcase-removal': allowRunTCaseRemoval, ...fields }) => ({
		...kebabToCamelCaseKeys(fields),
		allowRunTCaseRemoval,
	}),
	check: requireAnyFieldOrBody('update-to-latest-version', 'allow-run-tcase-removal'),
	epilog: help.tcasesUpdateVersion.epilog,
	examples: help.tcasesUpdateVersion.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.runs.updateTCaseVersion(
				pathParams['project-code'],
				pathParams['run-id'],
				pathParams['tcase-id'],
				body as UpdateRunTCaseVersionRequest
			)
		)
	},
}

const logsList: ApiEndpointSpec = {
	id: 'runs.logs.list',
	commandPath: ['runs', 'logs', 'list'],
	describe: help.logsList.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam],
	queryOptions: paginationOptions(['created_at', 'api_key_id'], help['logs-sort-field']),
	epilog: help.logsList.epilog,
	examples: help.logsList.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.runs.listLogs(
				pathParams['project-code'],
				pathParams['run-id'],
				query as ListRunLogsRequest
			)
		)
	},
}

const logsCreate: ApiEndpointSpec = {
	id: 'runs.logs.create',
	commandPath: ['runs', 'logs', 'create'],
	describe: help.logsCreate.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, runIdParam],
	fieldOptions: [
		{
			name: 'comment',
			type: 'string',
			describe: help.comment,
			schema: CreateRunLogRequestSchema.shape.comment,
		},
	],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.comment !== undefined
			? true
			: 'Either --body, --body-file, or --comment is required'
	},
	epilog: help.logsCreate.epilog,
	examples: help.logsCreate.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.runs.createLog(
				pathParams['project-code'],
				pathParams['run-id'],
				body as CreateRunLogRequest
			)
		)
	},
}

export const runSpecs: ApiEndpointSpec[] = [
	list,
	listAssigned,
	openStatusCounts,
	get,
	selections,
	folders,
	statusCounts,
	preview,
	create,
	clone,
	update,
	close,
	reopen,
	bulkClose,
	bulkReopen,
	move,
	remove,
	tcasesList,
	tcasesGet,
	tcasesUpdateVersion,
	logsList,
	logsCreate,
]
