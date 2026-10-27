import { z } from 'zod'
import {
	CreateResultsRequestSchema,
	resultLinksSchema,
	type CreateResultRequest,
	type UpdateResultRequest,
} from '../../../api/results'
import { resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	intIdParam,
	intListSchema,
	projectCodeParam,
	requireAnyFieldOrBody,
	splitIntList,
} from './utils'
import type { ApiEndpointSpec } from '../types'

/**
 * Accepts either `{ items: [...] }` or a bare array of result items.
 * A bare array is automatically wrapped into the `{ items }` shape.
 */
const batchCreateResultsInputSchema = z
	.unknown()
	.transform((val) => (Array.isArray(val) ? { items: val } : val))
	.pipe(CreateResultsRequestSchema)

const help = {
	...commonHelp,
	'run-id': 'Test run ID.',
	'tcase-id': 'Test case ID, sequence number or legacy ID.',
	status: 'Result status: passed, failed, blocked, skipped, open, custom1-4.',
	comment: 'Result comment (supports HTML).',
	'time-taken': 'Time taken in milliseconds.',
	links: `JSON array of at most 5 issues to link to the result, each with the "integrationId" (see integrations list), the issue's "url" and "text" (its title), and for a Jira, GitHub or Linear issue "meta": {"id": ...} with its ID (for GitHub, its number). The issue must be in the project's linked Jira project, GitHub repository or Linear team, and gets a reference back to the result.\nExample: '[{"integrationId": "1CSWAh3ys_YniqfXepnwT8F", "url": "https://acme.atlassian.net/browse/QA-12", "text": "Login fails", "meta": {"id": "10394"}}]'`,
	'create-links': `JSON array of issues to link to the result, as --links on results create; the result then holds at most 5 links.`,
	'delete-link-ids': "Comma-separated IDs of the result's links to remove (see results get).",
	'result-id': 'Result ID.',
	items: `JSON array of at most 1000 result items for batch creation, with at most 100 links across them.\nEach item has: tcaseId (test case ID, sequence number or legacy ID), status (string), comment? (string, supports HTML), timeTaken? (number|null), links? (array, as --links on results create).\nExample: '[{"tcaseId": "4", "status": "passed"}]'`,
	get: {
		describe: 'Get a result of a run, with its links.',
		epilog: apiDocsEpilog('result', 'get-result'),
		examples: [
			{
				usage: '$0 api results get --project-code PRJ --run-id 1 --result-id 10',
				description: 'Get a result',
			},
		],
	},
	update: {
		describe:
			"Change a result's comment or time taken, or add or remove its links. Fields left out keep their values. Only the result's author can update it, and its status can't change: add a new result instead.",
		epilog: apiDocsEpilog('result', 'update-result'),
		examples: [
			{
				usage:
					'$0 api results update --project-code PRJ --run-id 1 --result-id 10 --comment "Retried: flaky network"',
				description: "Change a result's comment",
			},
		],
	},
	create: {
		describe: 'Create a result for a test case in a run.',
		epilog: apiDocsEpilog('result', 'add-result'),
		examples: [
			{
				usage: '$0 api results create --project-code PRJ --run-id 1 --tcase-id 4 --status passed',
				description: 'Create a passed result',
			},
			{
				usage:
					'$0 api results create --project-code PRJ --run-id 1 --tcase-id 4 --body \'{"status": "passed", "comment": "All checks passed"}\'',
				description: 'Create a result using --body',
			},
		],
	},
	batchCreate: {
		describe: 'Create results for multiple test cases in a run.',
		epilog: apiDocsEpilog('result', 'add-multiple-results'),
		examples: [
			{
				usage:
					'$0 api results batch-create --project-code PRJ --run-id 1 --body \'{"items": [{"tcaseId": "4", "status": "passed"}, {"tcaseId": "5", "status": "failed"}]}\'',
				description: 'Batch create results using --body',
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

const resultIdParam = intIdParam('result-id', help['result-id'])

const get: ApiEndpointSpec = {
	id: 'results.get',
	commandPath: ['results', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, runIdParam, resultIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.results.get(
				pathParams['project-code'],
				pathParams['run-id'],
				pathParams['result-id']
			)
		)
	},
}

const create: ApiEndpointSpec = {
	id: 'results.create',
	commandPath: ['results', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [
		projectCodeParam,
		{
			name: 'run-id',
			type: 'number',
			describe: help['run-id'],
			schema: z.number().int().positive('must be a positive integer'),
		},
		{ name: 'tcase-id', type: 'string', describe: help['tcase-id'], schema: resourceIdSchema },
	],
	fieldOptions: [
		{
			name: 'status',
			type: 'string',
			describe: help.status,
			choices: [
				'passed',
				'failed',
				'blocked',
				'skipped',
				'open',
				'custom1',
				'custom2',
				'custom3',
				'custom4',
			],
		},
		{ name: 'comment', type: 'string', describe: help.comment },
		{
			name: 'time-taken',
			type: 'number',
			describe: help['time-taken'],
			schema: z.number().int().nonnegative(),
		},
		{
			name: 'links',
			type: 'string',
			describe: help.links,
			schema: resultLinksSchema,
			jsonParse: true,
		},
	],

	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.status !== undefined
			? true
			: 'Either --body, --body-file, or --status is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.results.create(
				pathParams['project-code'],
				pathParams['run-id'],
				pathParams['tcase-id'],
				body as CreateResultRequest
			)
		)
	},
}

const batchCreate: ApiEndpointSpec = {
	id: 'results.batch-create',
	commandPath: ['results', 'batch-create'],
	describe: help.batchCreate.describe,
	bodyMode: 'json',
	pathParams: [
		projectCodeParam,
		{
			name: 'run-id',
			type: 'number',
			describe: help['run-id'],
			schema: z.number().int().positive('must be a positive integer'),
		},
	],
	fieldOptions: [
		{
			name: 'items',
			type: 'string',
			describe: help.items,
			schema: batchCreateResultsInputSchema,
			jsonParse: true,
		},
	],
	transformFields: (fields) => {
		// items is already parsed and validated (may be wrapped in { items } by the schema transform)
		const parsed = fields.items as { items: unknown[] }
		return parsed
	},
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.items !== undefined
			? true
			: 'Either --body, --body-file, or --items is required'
	},
	epilog: help.batchCreate.epilog,
	examples: help.batchCreate.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.results.createBatch(
				pathParams['project-code'],
				pathParams['run-id'],
				body as Parameters<typeof api.results.createBatch>[2]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'results.update',
	commandPath: ['results', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, runIdParam, resultIdParam],
	fieldOptions: [
		{ name: 'comment', type: 'string', describe: help.comment },
		{
			name: 'time-taken',
			type: 'number',
			describe: help['time-taken'],
			schema: z.number().int().nonnegative(),
		},
		{
			name: 'create-links',
			type: 'string',
			describe: help['create-links'],
			schema: resultLinksSchema,
			jsonParse: true,
		},
		{
			name: 'delete-link-ids',
			type: 'string',
			describe: help['delete-link-ids'],
			schema: intListSchema,
		},
	],
	transformFields: (fields) => ({
		...kebabToCamelCaseKeys(fields),
		deleteLinkIds: splitIntList(fields['delete-link-ids']),
	}),
	check: requireAnyFieldOrBody('comment', 'time-taken', 'create-links', 'delete-link-ids'),
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.results.update(
				pathParams['project-code'],
				pathParams['run-id'],
				pathParams['result-id'],
				body as UpdateResultRequest
			)
		)
	},
}

export const resultSpecs: ApiEndpointSpec[] = [get, create, batchCreate, update]
