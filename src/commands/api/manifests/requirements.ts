import { sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
	list: {
		describe: 'List requirements in a project.',
		epilog: apiDocsEpilog('requirements', 'list-requirements'),
		examples: [
			{
				usage: '$0 api requirements list --project-code PRJ',
				description: 'List requirements',
			},
			{
				usage: '$0 api requirements list --project-code PRJ --include tcaseCount',
				description: 'List with test case counts',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'requirements.list',
	commandPath: ['requirements', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['created_at', 'text'],
		},
		{
			name: 'sort-order',
			type: 'string',
			describe: help['sort-order'],
			schema: sortOrderParam,
			choices: ['asc', 'desc'],
		},
		{ name: 'include', type: 'string', describe: help.include },
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.requirements.list(
				pathParams['project-code'],
				query as Parameters<typeof api.requirements.list>[1]
			)
		)
	},
}

export const requirementSpecs: ApiEndpointSpec[] = [list]
