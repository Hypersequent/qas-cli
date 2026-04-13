import { printJson, apiDocsEpilog } from '../utils'
import { projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	list: {
		describe: 'List all tags in a project.',
		epilog: apiDocsEpilog('tag', 'list-project-tags'),
		examples: [
			{ usage: '$0 api tags list --project-code PRJ', description: 'List tags in a project' },
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'tags.list',
	commandPath: ['tags', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.tags.list(pathParams['project-code']))
	},
}

export const tagSpecs: ApiEndpointSpec[] = [list]
