import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List shared preconditions in a project.',
		'sort-field': 'Field to sort by (created_at or title).',
		'sort-order': 'Sort direction (asc or desc).',
		include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
		epilog: apiDocsEpilog('shared_preconditions', 'list-shared-preconditions'),
	},

	get: {
		command: 'Get a shared precondition by ID.',
		id: 'Shared precondition ID.',
		epilog: apiDocsEpilog('shared_preconditions', 'get-shared-precondition'),
	},
} as const
