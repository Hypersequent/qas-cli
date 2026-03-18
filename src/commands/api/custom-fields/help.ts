import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List all custom fields in a project.',
		epilog: apiDocsEpilog('tcases_custom_fields', 'list-project-custom-fields'),
	},
} as const
