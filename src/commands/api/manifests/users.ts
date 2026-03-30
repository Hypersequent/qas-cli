import { printJson, apiDocsEpilog } from '../utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	list: {
		describe: 'List all users in the organization.',
		epilog: apiDocsEpilog('users', 'list-users'),
		examples: [{ usage: '$0 api users list', description: 'List all users' }],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'users.list',
	commandPath: ['users', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api) => {
		printJson(await api.users.list())
	},
}

export const userSpecs: ApiEndpointSpec[] = [list]
