import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,
	'run-id': 'Test run ID.',

	create: {
		command: 'Create a result for a test case in a run.',
		'tcase-id': 'Test case ID within the run.',
		status:
			'Result status (passed, failed, blocked, skipped, open, custom1, custom2, custom3, custom4).',
		comment: 'Result comment (supports HTML).',
		'time-taken': 'Time taken in milliseconds.',
		links: `JSON array of result links. Each link has "text" and "url" fields.
Accepts inline JSON or @filename.
Example: '[{"text": "Log", "url": "https://ci.example.com/123"}]'`,
		epilog: apiDocsEpilog('result', 'add-result'),
	},

	'batch-create': {
		command: 'Create results for multiple test cases in a run.',
		items: `JSON array of result items for batch creation.
Accepts inline JSON or @filename.
Each item has: tcaseId (string), status (string), comment? (string, supports HTML), timeTaken? (number|null), links? (array).
Example: '[{"tcaseId": "abc", "status": "passed"}]'`,
		epilog: apiDocsEpilog('result', 'add-multiple-results'),
	},

	examples: [
		{
			usage: '$0 api results create --project-code PRJ --run-id 1 --tcase-id abc --status passed',
			description: 'Create a passed result',
		},
	],
} as const
