import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List milestones in a project.',
		archived: 'Filter by archived status. If omitted, returns all milestones.',
		epilog: apiDocsEpilog('milestone', 'list-project-milestones'),
	},

	create: {
		command: 'Create a new milestone.',
		title: 'Display title for the milestone (max 255 characters).',
		epilog: apiDocsEpilog('milestone', 'create-milestone'),
	},

	examples: [
		{
			usage: '$0 api milestones create --project-code PRJ --title "v1.0"',
			description: 'Create a new milestone',
		},
	],
} as const
