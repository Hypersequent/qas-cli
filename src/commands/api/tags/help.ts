import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List all tags in a project.',
		epilog: apiDocsEpilog('tag', 'list-project-tags'),
	},
} as const
