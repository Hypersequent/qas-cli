import {
	CreateReportRequestSchema,
	reportNameSchema,
	reportTypes,
	type DeleteReportsRequest,
	type ListReportsRequest,
} from '../../../api/reports'
import { dateOnlySchema, resourceIdSchema } from '../../../api/schemas'
import { printJson, apiDocsEpilog, kebabToCamelCaseKeys } from '../utils'
import {
	commonHelp,
	idListSchema,
	intListSchema,
	paginationOptions,
	projectCodeParam,
	requireFieldsOrBody,
	splitIntList,
	splitList,
} from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	'report-id': 'Report ID or sequence number.',
	'report-ids': 'Comma-separated report IDs or sequence numbers (e.g., "3,4"), at most 1000.',
	'report-types': 'Comma-separated report types to filter by.',
	'user-ids': 'Comma-separated IDs of the users who created the reports (see users list).',
	'created-after':
		'Reports created at or after this time (RFC 3339, e.g., "2026-10-01T00:00:00Z").',
	'created-before':
		'Reports created at or before this time (RFC 3339, e.g., "2026-11-01T00:00:00Z").',
	type: 'Report type. runComparison takes exactly two --run-ids, the baseline first; tcaseAutomation takes only a period and needs --start-date.',
	name: 'Report name, 1-255 characters.',
	'run-ids': 'Comma-separated IDs of the runs the report covers.',
	'milestone-ids': 'Comma-separated IDs of the milestones whose runs the report covers.',
	'start-date':
		'First UTC day of the period (YYYY-MM-DD): the report covers runs created on or after it.',
	'end-date':
		'Last UTC day of the period (YYYY-MM-DD): the report covers runs created on or before it.',
	list: {
		describe:
			'List the saved reports of a project, newest first. Reports show what they cover, not their data.',
		epilog: apiDocsEpilog('reports', 'list-reports'),
		examples: [
			{ usage: '$0 api reports list --project-code PRJ', description: 'List reports' },
			{
				usage: '$0 api reports list --project-code PRJ --report-types runScorecard,effort',
				description: 'List the scorecard and effort reports',
			},
		],
	},
	get: {
		describe:
			'Get a report, with the runs it covers. The API returns what a report covers, not its data.',
		epilog: apiDocsEpilog('reports', 'get-report'),
		examples: [
			{
				usage: '$0 api reports get --project-code PRJ --report-id 3',
				description: 'Get a report by sequence number',
			},
		],
	},
	create: {
		describe:
			"Create a report from the project's data at this moment. It covers --run-ids, --milestone-ids or a period (--start-date, --end-date): one of them, never several.",
		epilog: apiDocsEpilog('reports', 'create-report'),
		examples: [
			{
				usage:
					'$0 api reports create --project-code PRJ --type runScorecard --name "Release 2.4 scorecard" --milestone-ids 4',
				description: "Create a scorecard of a milestone's runs",
			},
			{
				usage:
					'$0 api reports create --project-code PRJ --type runComparison --name "Chrome vs Firefox" --run-ids 11,12',
				description: 'Compare run 12 with run 11',
			},
			{
				usage:
					'$0 api reports create --project-code PRJ --type tcaseAutomation --name "October coverage" --start-date 2026-10-01 --end-date 2026-10-31',
				description: 'Create an automation coverage report for October',
			},
		],
	},
	update: {
		describe:
			"Rename a report. What it covers and its data can't change; create another report for that.",
		epilog: apiDocsEpilog('reports', 'update-report'),
		examples: [
			{
				usage: '$0 api reports update --project-code PRJ --report-id 3 --name "Release 2.4"',
				description: 'Rename a report',
			},
		],
	},
	delete: {
		describe:
			"Delete reports for good: they don't go to the trash. When one of them doesn't exist, nothing is deleted.",
		epilog: apiDocsEpilog('reports', 'delete-reports'),
		examples: [
			{
				usage: '$0 api reports delete --project-code PRJ --report-ids 3,4',
				description: 'Delete two reports',
			},
		],
	},
} as const

const reportIdParam = {
	name: 'report-id',
	type: 'string',
	describe: help['report-id'],
	schema: resourceIdSchema,
} as const

const nameField = {
	name: 'name',
	type: 'string',
	describe: help.name,
	schema: reportNameSchema,
} as const

const list: ApiEndpointSpec = {
	id: 'reports.list',
	commandPath: ['reports', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'report-types',
			type: 'string',
			describe: help['report-types'],
			helpChoices: reportTypes,
		},
		{ name: 'user-ids', type: 'string', describe: help['user-ids'], schema: intListSchema },
		{ name: 'created-after', type: 'string', describe: help['created-after'] },
		{ name: 'created-before', type: 'string', describe: help['created-before'] },
		...paginationOptions(['created_at', 'type']),
	],
	transformQuery: (query) => ({
		...kebabToCamelCaseKeys(query),
		reportTypes: splitList(query['report-types']),
		userIds: splitIntList(query['user-ids']),
	}),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(await api.reports.list(pathParams['project-code'], query as ListReportsRequest))
	},
}

const get: ApiEndpointSpec = {
	id: 'reports.get',
	commandPath: ['reports', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, reportIdParam],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.reports.get(pathParams['project-code'], pathParams['report-id']))
	},
}

const create: ApiEndpointSpec = {
	id: 'reports.create',
	commandPath: ['reports', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'type',
			type: 'string',
			describe: help.type,
			schema: CreateReportRequestSchema.shape.type,
			helpChoices: reportTypes,
		},
		nameField,
		{ name: 'run-ids', type: 'string', describe: help['run-ids'], schema: intListSchema },
		{
			name: 'milestone-ids',
			type: 'string',
			describe: help['milestone-ids'],
			schema: intListSchema,
		},
		{ name: 'start-date', type: 'string', describe: help['start-date'], schema: dateOnlySchema },
		{ name: 'end-date', type: 'string', describe: help['end-date'], schema: dateOnlySchema },
	],
	transformFields: (fields) => ({
		...kebabToCamelCaseKeys(fields),
		runIds: splitIntList(fields['run-ids']),
		milestoneIds: splitIntList(fields['milestone-ids']),
	}),
	check: requireFieldsOrBody('type', 'name'),
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.reports.create(
				pathParams['project-code'],
				body as Parameters<typeof api.reports.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'reports.update',
	commandPath: ['reports', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, reportIdParam],
	fieldOptions: [nameField],
	check: requireFieldsOrBody('name'),
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.reports.update(
				pathParams['project-code'],
				pathParams['report-id'],
				body as Parameters<typeof api.reports.update>[2]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'reports.delete',
	commandPath: ['reports', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{ name: 'report-ids', type: 'string', describe: help['report-ids'], schema: idListSchema },
	],
	transformFields: (fields) => ({ reportIds: splitList(fields['report-ids']) }),
	check: requireFieldsOrBody('report-ids'),
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(await api.reports.delete(pathParams['project-code'], body as DeleteReportsRequest))
	},
}

export const reportSpecs: ApiEndpointSpec[] = [list, get, create, update, remove]
