import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,

	list: {
		command: 'List folders in a project.',
		page: 'Page number for pagination (starts at 1).',
		limit: 'Maximum number of items per page.',
		'sort-field':
			'Field to sort by (id, project_id, title, pos, parent_id, created_at, updated_at).',
		'sort-order': 'Sort direction.',
		epilog: apiDocsEpilog('folders', 'list-project-folders'),
	},

	'bulk-create': {
		command: 'Create or update multiple folders at once.',
		folders: `JSON array of folder objects. Each folder has a "path" (string array) and optional "comment" (supports HTML).
Accepts inline JSON or @filename.
Example: '[{"path": ["Parent", "Child"]}]'`,
		epilog: apiDocsEpilog('folders', 'bulk-upsert-folders'),
	},

	examples: [
		{
			usage:
				'$0 api folders bulk-create --project-code PRJ --folders \'[{"path": ["Suite", "Auth"]}]\'',
			description: 'Create nested folders',
		},
	],
} as const
