import { z } from 'zod'
import { printJson, apiDocsEpilog } from '../utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	after: 'Cursor for pagination. Returns events with ID greater than this value.',
	count: 'Number of events to return per page. Must be between 1 and 1000. Omit to use default.',
	list: {
		describe: 'List audit log entries.',
		epilog: apiDocsEpilog('audit_logs', 'list-audit-logs'),
		examples: [
			{ usage: '$0 api audit-logs list', description: 'List audit log entries' },
			{
				usage: '$0 api audit-logs list --after 100 --count 50',
				description: 'List entries after cursor 100',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'audit-logs.list',
	commandPath: ['audit-logs', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [],
	queryOptions: [
		{
			name: 'after',
			type: 'number',
			describe: help.after,
			schema: z.number().int().nonnegative().optional(),
		},
		{
			name: 'count',
			type: 'number',
			describe: help.count,
			schema: z.number().int().positive().optional(),
		},
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { query }) => {
		printJson(await api.auditLogs.list(query as Parameters<typeof api.auditLogs.list>[0]))
	},
}

export const auditLogSpecs: ApiEndpointSpec[] = [list]
