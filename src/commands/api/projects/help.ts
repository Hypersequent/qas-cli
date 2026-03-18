import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code or ID identifying the QA Sphere project.`,

	list: {
		command: 'List all projects.',
		epilog: apiDocsEpilog('projects', 'list-projects'),
	},

	get: {
		command: 'Get a project by code or ID.',
		epilog: apiDocsEpilog('projects', 'get-project'),
	},

	create: {
		command: 'Create a new project.',
		code: `Short project code (2-5 alphanumeric characters, e.g., "PRJ").
Used in URLs and test case references.`,
		title: `Display title for the project (max 255 characters).`,
		links: `JSON array of project links. Each link has "text" and "url" fields.
Accepts inline JSON or @filename.
Example: '[{"text": "Docs", "url": "https://example.com"}]'`,
		'overview-title': 'Title for the project overview page (max 255 characters).',
		'overview-description': 'Description for the project overview page (supports HTML).',
		epilog: apiDocsEpilog('projects', 'create-project'),
	},

	examples: [
		{
			usage: '$0 api projects create --code PRJ --title "My Project"',
			description: 'Create a new project',
		},
	],
} as const
