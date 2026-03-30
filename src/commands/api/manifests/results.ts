import { z } from 'zod'
import {
	CreateResultsRequestSchema,
	resultLinksSchema,
	type CreateResultRequest,
} from '../../../api/results'
import { resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
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
	'tcase-id': 'Test case ID within the run.',
	status: 'Result status: passed, failed, blocked, skipped, open, custom1-4.',
	comment: 'Result comment (supports HTML).',
	'time-taken': 'Time taken in milliseconds.',
	links: `JSON array of result links. Each link has "text" and "url" fields.\nExample: '[{"text": "Log", "url": "https://ci.example.com/123"}]'`,
	items: `JSON array of result items for batch creation.\nEach item has: tcaseId (string), status (string), comment? (string, supports HTML), timeTaken? (number|null), links? (array).\nExample: '[{"tcaseId": "abc", "status": "passed"}]'`,
	create: {
		describe: 'Create a result for a test case in a run.',
		epilog: apiDocsEpilog('result', 'add-result'),
		examples: [
			{
				usage: '$0 api results create --project-code PRJ --run-id 1 --tcase-id abc --status passed',
				description: 'Create a passed result',
			},
			{
				usage:
					'$0 api results create --project-code PRJ --run-id 1 --tcase-id abc --body \'{"status": "passed", "comment": "All checks passed"}\'',
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
					'$0 api results batch-create --project-code PRJ --run-id 1 --body \'{"items": [{"tcaseId": "abc", "status": "passed"}, {"tcaseId": "def", "status": "failed"}]}\'',
				description: 'Batch create results using --body',
			},
		],
	},
} as const

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

export const resultSpecs: ApiEndpointSpec[] = [create, batchCreate]
