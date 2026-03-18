import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	create: {
		command: 'Create a new test plan.',
		body: `JSON object for the test plan body.
Accepts inline JSON or @filename.
Must include "title" and "runs" array. Each run needs "title", "type", and "queryPlans".
Example: '{"title": "Plan", "runs": [{"title": "Run 1", "type": "static", "queryPlans": [{"tcaseIds": ["abc"]}]}]}'`,
		epilog: apiDocsEpilog('plan', 'create-new-test-plan'),
	},

	examples: [
		{
			usage: '$0 api test-plans create --project-code PRJ --body @plan.json',
			description: 'Create a test plan from a JSON file',
		},
	],
} as const
