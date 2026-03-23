import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List shared steps in a project.',
		'sort-field': 'Field to sort by (created_at or title).',
		'sort-order': 'Sort direction (asc or desc).',
		include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
		epilog: apiDocsEpilog('shared_steps', 'list-shared-steps'),
	},

	get: {
		command:
			'Get a shared step by ID. The response "description", "expected", and sub-step fields contain HTML.',
		id: 'Shared step ID.',
		epilog: apiDocsEpilog('shared_steps', 'get-shared-step'),
	},
} as const
