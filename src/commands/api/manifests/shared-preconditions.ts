import { z } from 'zod'
import { sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	id: 'Shared precondition ID.',
	include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
	list: {
		describe: 'List shared preconditions in a project.',
		epilog: apiDocsEpilog('shared_preconditions', 'list-shared-preconditions'),
		examples: [
			{
				usage: '$0 api shared-preconditions list --project-code PRJ',
				description: 'List shared preconditions',
			},
		],
	},
	get: {
		describe: 'Get a shared precondition by ID. The response "text" field contains HTML.',
		epilog: apiDocsEpilog('shared_preconditions', 'get-shared-precondition'),
		examples: [
			{
				usage: '$0 api shared-preconditions get --project-code PRJ --id 1',
				description: 'Get a shared precondition',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'shared-preconditions.list',
	commandPath: ['shared-preconditions', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{
			name: 'sort-field',
			type: 'string',
			describe: help['sort-field'],
			schema: sortFieldParam,
			choices: ['created_at', 'title'],
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
			await api.sharedPreconditions.list(
				pathParams['project-code'],
				query as Parameters<typeof api.sharedPreconditions.list>[1]
			)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'shared-preconditions.get',
	commandPath: ['shared-preconditions', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [
		projectCodeParam,
		{
			name: 'id',
			type: 'number',
			describe: help.id,
			schema: z.number().int().positive('must be a positive integer'),
		},
	],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(
			await api.sharedPreconditions.get(pathParams['project-code'], pathParams['id'] as number)
		)
	},
}

export const sharedPreconditionSpecs: ApiEndpointSpec[] = [list, get]
