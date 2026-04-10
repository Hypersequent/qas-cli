import { printJson, apiDocsEpilog } from '../utils'
import { projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	list: {
		describe: 'List all custom fields in a project.',
		epilog: apiDocsEpilog('tcases_custom_fields', 'list-project-custom-fields'),
		examples: [
			{
				usage: '$0 api custom-fields list --project-code PRJ',
				description: 'List custom fields',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'custom-fields.list',
	commandPath: ['custom-fields', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.customFields.list(pathParams['project-code']))
	},
}

export const customFieldSpecs: ApiEndpointSpec[] = [list]
