import { z } from 'zod'
import { CUSTOM_STATUS_IDS, STATUS_COLORS } from '../../../api/settings'
import { printJson, apiDocsEpilog } from '../utils'
import type { ApiEndpointSpec } from '../types'

const statusItemSchema = z.object({
	id: z.enum(CUSTOM_STATUS_IDS),
	name: z.string().min(1, 'name must not be empty'),
	color: z.enum(STATUS_COLORS, { message: `color must be one of ${STATUS_COLORS.join(', ')}` }),
	isActive: z.boolean(),
})

const updateStatusesInputSchema = z
	.array(statusItemSchema)
	.min(1, 'Must contain at least one status')

const help = {
	statuses: `JSON array of custom status objects.\nEach status has: id (custom1-4), name (string), color (named color), isActive (boolean).\nValid colors: ${STATUS_COLORS.join(', ')}.\nExample: '[{"id": "custom1", "name": "Retest", "color": "orange", "isActive": true}]'`,
	listStatuses: {
		describe: 'List all result statuses (including custom statuses).',
		epilog: apiDocsEpilog('settings', 'get-statuses'),
		examples: [
			{
				usage: '$0 api settings list-statuses',
				description: 'List all result statuses',
			},
		],
	},
	updateStatuses: {
		describe: 'Update custom result statuses.',
		epilog: apiDocsEpilog('settings', 'update-custom-statuses'),
		examples: [
			{
				usage:
					'$0 api settings update-statuses --statuses \'[{"id": "custom1", "name": "Retest", "color": "orange", "isActive": true}]\'',
				description: 'Activate a custom status',
			},
			{
				usage:
					'$0 api settings update-statuses --body \'{"statuses": [{"id": "custom1", "name": "Retest", "color": "orange", "isActive": true}]}\'',
				description: 'Update statuses using --body',
			},
		],
	},
} as const

const listStatuses: ApiEndpointSpec = {
	id: 'settings.list-statuses',
	commandPath: ['settings', 'list-statuses'],
	describe: help.listStatuses.describe,
	bodyMode: 'none',
	pathParams: [],
	epilog: help.listStatuses.epilog,
	examples: help.listStatuses.examples,
	execute: async (api) => {
		printJson(await api.settings.list())
	},
}

const updateStatuses: ApiEndpointSpec = {
	id: 'settings.update-statuses',
	commandPath: ['settings', 'update-statuses'],
	describe: help.updateStatuses.describe,
	bodyMode: 'json',
	pathParams: [],
	fieldOptions: [
		{
			name: 'statuses',
			type: 'string',
			describe: help.statuses,
			schema: updateStatusesInputSchema,
			jsonParse: true,
		},
	],
	transformFields: (fields) => ({ statuses: fields.statuses }),
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.statuses !== undefined
			? true
			: 'Either --body, --body-file, or --statuses is required'
	},
	epilog: help.updateStatuses.epilog,
	examples: help.updateStatuses.examples,
	execute: async (api, { body }) => {
		printJson(await api.settings.update(body as Parameters<typeof api.settings.update>[0]))
	},
}

export const settingSpecs: ApiEndpointSpec[] = [listStatuses, updateStatuses]
