import { z } from 'zod'
import {
	CreateTestPlanRequestSchema,
	MoveTestPlansRequestSchema,
	PlanRunSchema,
	UpdateTestPlanRequestSchema,
	UpdateTestPlanRunRequestSchema,
	type ListTestPlansRequest,
	type MoveTestPlansRequest,
	type UpdateTestPlanRequest,
	type UpdateTestPlanRunRequest,
} from '../../../api/test-plans'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	intIdParam,
	intListSchema,
	paginationOptions,
	projectCodeParam,
	requireAnyFieldOrBody,
	requireFieldsOrBody,
	splitIntList,
} from './utils'
import type { ApiEndpointSpec } from '../types'

const CreateTestPlanShape = CreateTestPlanRequestSchema.shape
const UpdateTestPlanShape = UpdateTestPlanRequestSchema.shape
const UpdateTestPlanRunShape = UpdateTestPlanRunRequestSchema.shape

const help = {
	...commonHelp,
	title: 'Test plan title, 1-255 characters.',
	description: 'Optional description for the test plan.',
	'milestone-id': 'ID of the milestone to associate with this test plan.',
	'integration-issue-id':
		"ID or key of an issue in the project's Jira or Linear integration to link the test plan to.",
	runs: `JSON array of run objects.\nEach run needs a "title" and exactly one query plan listing its "tcaseIds" (test case IDs, sequence numbers or legacy IDs), and takes an "assignmentId" and a "configurationId".\nExample: '[{"title": "Chrome", "queryPlans": [{"tcaseIds": ["12", "13"]}]}]'`,
	'update-runs': `JSON array that replaces the whole list of runs. Keep a run by passing its "id" (see test-plans get). Runs left out are deleted for good, with their results, and a kept run's assignee and configuration are cleared when left out. To change one run, use test-plans update-run.\nExample: '[{"id": 7, "title": "Chrome", "queryPlans": [{"tcaseIds": ["12"]}]}]'`,
	'update-milestone-id':
		'Milestone to move the test plan and its runs to; 0 takes them out of their milestone.',
	'update-integration-issue-id':
		'Issue to link the test plan to in the project\'s Jira or Linear integration; "" removes the link.',
	'plan-id': 'Test plan ID.',
	'plan-ids': 'Comma-separated test plan IDs (e.g., "1,2"), at most 100.',
	'run-id': 'ID of a run of the test plan.',
	'run-title': 'New run title, 1-255 characters.',
	'assignment-id': 'User to assign the run to; 0 unassigns it.',
	'configuration-id': 'Configuration of the run; "" removes it.',
	'query-plans': `JSON array with exactly one query plan, listing the "tcaseIds" (test case IDs, sequence numbers or legacy IDs) that replace the run's.\nExample: '[{"tcaseIds": ["12", "13"]}]'`,
	'move-milestone-id': 'Milestone to move the test plans to; 0 takes them out of their milestone.',
	closed: 'Filter by state: true for closed test plans, false for open ones.',
	'milestone-ids': 'Comma-separated milestone IDs to filter by (e.g., "1,2").',
	'list-sort-field':
		'Field to sort by; created_at by default. last_activity_at is the latest result or run log in any of its runs, and closed_at puts open plans last.',
	create: {
		describe: 'Create a new test plan.',
		epilog: apiDocsEpilog('plan', 'create-new-test-plan'),
		examples: [
			{
				usage:
					'$0 api test-plans create --project-code PRJ --title "Release Plan" --runs \'[{"title": "Smoke Tests", "queryPlans": [{"tcaseIds": ["4"]}]}]\'',
				description: 'Create a test plan with individual fields',
			},
			{
				usage: '$0 api test-plans create --project-code PRJ --body-file plan.json',
				description: 'Create a test plan from a JSON file',
			},
			{
				usage:
					'$0 api test-plans create --project-code PRJ --body \'{"title": "Release Plan", "runs": [{"title": "Smoke Tests", "queryPlans": [{"tcaseIds": ["4"]}]}]}\'',
				description: 'Create a test plan using --body',
			},
		],
	},
	list: {
		describe: 'List the test plans of a project, without their runs.',
		epilog: apiDocsEpilog('plan', 'list-test-plans'),
		examples: [
			{
				usage: '$0 api test-plans list --project-code PRJ --closed false',
				description: 'List open test plans',
			},
		],
	},
	get: {
		describe: 'Get a test plan with its milestone and runs.',
		epilog: apiDocsEpilog('plan', 'get-test-plan'),
		examples: [
			{
				usage: '$0 api test-plans get --project-code PRJ --plan-id 1',
				description: 'Get a test plan',
			},
		],
	},
	update: {
		describe:
			'Update a test plan. Fields left out keep their values. A closed test plan must be reopened first.',
		epilog: apiDocsEpilog('plan', 'update-test-plan'),
		examples: [
			{
				usage: '$0 api test-plans update --project-code PRJ --plan-id 1 --title "Release 2"',
				description: 'Rename a test plan',
			},
		],
	},
	updateRun: {
		describe:
			'Update one run of a test plan. Fields left out keep their values. A closed test plan must be reopened first.',
		epilog: apiDocsEpilog('plan', 'update-test-plan-run'),
		examples: [
			{
				usage:
					'$0 api test-plans update-run --project-code PRJ --plan-id 1 --run-id 7 --assignment-id 3',
				description: 'Assign a run of a test plan',
			},
		],
	},
	close: {
		describe: 'Close a test plan and all of its runs.',
		epilog: apiDocsEpilog('plan', 'close-test-plan'),
		examples: [
			{
				usage: '$0 api test-plans close --project-code PRJ --plan-id 1',
				description: 'Close a test plan',
			},
		],
	},
	reopen: {
		describe:
			'Reopen a closed test plan and its runs. The runs catch up with the changes made to their test cases while they were closed.',
		epilog: apiDocsEpilog('plan', 'reopen-test-plan'),
		examples: [
			{
				usage: '$0 api test-plans reopen --project-code PRJ --plan-id 1',
				description: 'Reopen a test plan',
			},
		],
	},
	move: {
		describe:
			'Move test plans, with their runs, into a milestone or out of their milestone. Closed plans stay closed.',
		epilog: apiDocsEpilog('plan', 'move-test-plans-to-milestone'),
		examples: [
			{
				usage: '$0 api test-plans move --project-code PRJ --plan-ids 1,2 --milestone-id 5',
				description: 'Move two test plans into milestone 5',
			},
		],
	},
	delete: {
		describe:
			'Delete a test plan with its runs. They go to the trash as one entry, which trash restore brings back together.',
		epilog: apiDocsEpilog('plan', 'delete-test-plan'),
		examples: [
			{
				usage: '$0 api test-plans delete --project-code PRJ --plan-id 1',
				description: 'Delete a test plan',
			},
		],
	},
} as const

const planIdParam = intIdParam('plan-id', help['plan-id'])

const list: ApiEndpointSpec = {
	id: 'test-plans.list',
	commandPath: ['test-plans', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'closed', type: 'boolean', describe: help.closed },
		{
			name: 'milestone-ids',
			type: 'string',
			describe: help['milestone-ids'],
			schema: intListSchema,
		},
		...paginationOptions(
			['title', 'created_at', 'last_activity_at', 'closed_at'],
			help['list-sort-field']
		),
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		milestoneIds: splitIntList(query['milestone-ids']),
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.testPlans.list(pathParams['project-code'], query as ListTestPlansRequest))
	},
}

const get: ApiEndpointSpec = {
	id: 'test-plans.get',
	commandPath: ['test-plans', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, planIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.testPlans.get(pathParams['project-code'], pathParams['plan-id']))
	},
}

const create: ApiEndpointSpec = {
	id: 'test-plans.create',
	commandPath: ['test-plans', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'title', type: 'string', describe: help.title, schema: CreateTestPlanShape.title },
		{
			name: 'description',
			type: 'string',
			describe: help.description,
			schema: CreateTestPlanShape.description.unwrap(),
		},
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['milestone-id'],
			schema: CreateTestPlanShape.milestoneId.unwrap(),
		},
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: help['integration-issue-id'],
			schema: CreateTestPlanShape.integrationIssueId.unwrap(),
		},
		{
			name: 'runs',
			type: 'string',
			describe: help.runs,
			schema: z.array(PlanRunSchema).min(1, 'Must contain at least one run'),
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
			await api.testPlans.create(
				pathParams['project-code'],
				body as Parameters<typeof api.testPlans.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'test-plans.update',
	commandPath: ['test-plans', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, planIdParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: UpdateTestPlanShape.title.unwrap(),
		},
		{ name: 'description', type: 'string', describe: help.description },
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['update-milestone-id'],
			schema: UpdateTestPlanShape.milestoneId.unwrap(),
		},
		{
			name: 'integration-issue-id',
			type: 'string',
			describe: help['update-integration-issue-id'],
			schema: UpdateTestPlanShape.integrationIssueId.unwrap(),
		},
		{
			name: 'runs',
			type: 'string',
			describe: help['update-runs'],
			schema: UpdateTestPlanShape.runs.unwrap(),
			jsonParse: true,
		},
	],
	check: requireAnyFieldOrBody(
		'title',
		'description',
		'milestone-id',
		'integration-issue-id',
		'runs'
	),
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testPlans.update(
				pathParams['project-code'],
				pathParams['plan-id'],
				body as UpdateTestPlanRequest
			)
		)
	},
}

const updateRun: ApiEndpointSpec = {
	id: 'test-plans.update-run',
	commandPath: ['test-plans', 'update-run'],
	describe: help.updateRun.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, planIdParam, intIdParam('run-id', help['run-id'])],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help['run-title'],
			schema: UpdateTestPlanRunShape.title.unwrap(),
		},
		{
			name: 'assignment-id',
			type: 'number',
			describe: help['assignment-id'],
			schema: UpdateTestPlanRunShape.assignmentId.unwrap(),
		},
		{ name: 'configuration-id', type: 'string', describe: help['configuration-id'] },
		{
			name: 'query-plans',
			type: 'string',
			describe: help['query-plans'],
			schema: UpdateTestPlanRunShape.queryPlans.unwrap(),
			jsonParse: true,
		},
	],
	check: requireAnyFieldOrBody('title', 'assignment-id', 'configuration-id', 'query-plans'),
	epilog: help.updateRun.epilog,
	examples: help.updateRun.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testPlans.updateRun(
				pathParams['project-code'],
				pathParams['plan-id'],
				pathParams['run-id'],
				body as UpdateTestPlanRunRequest
			)
		)
	},
}

const close: ApiEndpointSpec = {
	id: 'test-plans.close',
	commandPath: ['test-plans', 'close'],
	describe: help.close.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, planIdParam],
	epilog: help.close.epilog,
	examples: help.close.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.testPlans.close(pathParams['project-code'], pathParams['plan-id']))
	},
}

const reopen: ApiEndpointSpec = {
	id: 'test-plans.reopen',
	commandPath: ['test-plans', 'reopen'],
	describe: help.reopen.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, planIdParam],
	epilog: help.reopen.epilog,
	examples: help.reopen.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.testPlans.reopen(pathParams['project-code'], pathParams['plan-id']))
	},
}

const move: ApiEndpointSpec = {
	id: 'test-plans.move',
	commandPath: ['test-plans', 'move'],
	describe: help.move.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'plan-ids', type: 'string', describe: help['plan-ids'], schema: intListSchema },
		{
			name: 'milestone-id',
			type: 'number',
			describe: help['move-milestone-id'],
			schema: MoveTestPlansRequestSchema.shape.milestoneId,
		},
	],
	transformFields: (fields) => ({
		planIds: splitIntList(fields['plan-ids']),
		milestoneId: fields['milestone-id'],
	}),
	check: requireFieldsOrBody('plan-ids', 'milestone-id'),
	epilog: help.move.epilog,
	examples: help.move.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.testPlans.moveToMilestone(pathParams['project-code'], body as MoveTestPlansRequest)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'test-plans.delete',
	commandPath: ['test-plans', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, planIdParam],
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.testPlans.delete(pathParams['project-code'], pathParams['plan-id']))
	},
}

export const testPlanSpecs: ApiEndpointSpec[] = [
	list,
	get,
	create,
	update,
	updateRun,
	close,
	reopen,
	move,
	remove,
]
