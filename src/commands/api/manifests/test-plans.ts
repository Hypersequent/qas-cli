import { z } from 'zod'
import { CreateTestPlanRequestSchema } from '../../../api/test-plans'
import { RunSchema } from '../../../api/runs'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const CreateTestPlanShape = CreateTestPlanRequestSchema.shape

const help = {
	...commonHelp,
	title: 'Test plan title, 1-255 characters.',
	description: 'Optional description for the test plan.',
	'milestone-id': 'ID of the milestone to associate with this test plan.',
	runs: `JSON array of run objects.\nEach run needs "title", "type", and "queryPlans".\nExample: '[{"title": "Run 1", "type": "static", "queryPlans": [{"tcaseIds": ["abc"]}]}]'`,
	create: {
		describe: 'Create a new test plan.',
		epilog: apiDocsEpilog('plan', 'create-new-test-plan'),
		examples: [
			{
				usage:
					'$0 api test-plans create --project-code PRJ --title "Release Plan" --runs \'[{"title": "Smoke Tests", "type": "static", "queryPlans": [{"tcaseIds": ["abc"]}]}]\'',
				description: 'Create a test plan with individual fields',
			},
			{
				usage: '$0 api test-plans create --project-code PRJ --body-file plan.json',
				description: 'Create a test plan from a JSON file',
			},
			{
				usage:
					'$0 api test-plans create --project-code PRJ --body \'{"title": "Release Plan", "runs": [{"title": "Smoke Tests", "type": "static", "queryPlans": [{"tcaseIds": ["abc"]}]}]}\'',
				description: 'Create a test plan using --body',
			},
		],
	},
} as const

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
			name: 'runs',
			type: 'string',
			describe: help.runs,
			schema: z.array(RunSchema).min(1, 'Must contain at least one run'),
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

export const testPlanSpecs: ApiEndpointSpec[] = [create]
