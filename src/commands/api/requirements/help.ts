import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List requirements in a project.',
		'sort-field': 'Field to sort by (created_at or text).',
		'sort-order': 'Sort direction (asc or desc).',
		include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
		epilog: apiDocsEpilog('requirements', 'list-requirements'),
	},
} as const
