import { apiDocsEpilog } from '../utils'

export default {
	list: {
		command: 'List all users in the organization.',
		epilog: apiDocsEpilog('users', 'list-users'),
	},
} as const
