import { apiDocsEpilog } from '../utils'

export default {
	'list-statuses': {
		command: 'List all result statuses (including custom statuses).',
		epilog: apiDocsEpilog('settings', 'get-statuses'),
	},

	'update-statuses': {
		command: 'Update custom result statuses.',
		statuses: `JSON array of custom status objects.
Accepts inline JSON or @filename.
Each status has: id (custom1-4), name (string), color (hex string), isActive (boolean).
Example: '[{"id": "custom1", "name": "Retest", "color": "#FF9800", "isActive": true}]'`,
		epilog: apiDocsEpilog('settings', 'update-custom-statuses'),
	},

	examples: [
		{
			usage:
				'$0 api settings update-statuses --statuses \'[{"id": "custom1", "name": "Retest", "color": "#FF9800", "isActive": true}]\'',
			description: 'Activate a custom status',
		},
	],
} as const
