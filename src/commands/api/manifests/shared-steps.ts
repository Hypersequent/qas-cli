import { z } from 'zod'
import { sortFieldParam, sortOrderParam } from '../../../api/schemas'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	id: 'Shared step ID.',
	include: 'Include additional fields. Use "tcaseCount" to include linked test case count.',
	list: {
		describe: 'List shared steps in a project.',
		epilog: apiDocsEpilog('shared_steps', 'list-shared-steps'),
		examples: [
			{
				usage: '$0 api shared-steps list --project-code PRJ',
				description: 'List shared steps',
			},
		],
	},
	get: {
		describe:
			'Get a shared step by ID. The response "description", "expected", and sub-step fields contain HTML.',
		epilog: apiDocsEpilog('shared_steps', 'get-shared-step'),
		examples: [
			{
				usage: '$0 api shared-steps get --project-code PRJ --id 1',
				description: 'Get a shared step',
			},
		],
	},
} as const

const list: ApiEndpointSpec = {
	id: 'shared-steps.list',
	commandPath: ['shared-steps', 'list'],
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
			await api.sharedSteps.list(
				pathParams['project-code'],
				query as Parameters<typeof api.sharedSteps.list>[1]
			)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'shared-steps.get',
	commandPath: ['shared-steps', 'get'],
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
		printJson(await api.sharedSteps.get(pathParams['project-code'], pathParams['id'] as number))
	},
}

export const sharedStepSpecs: ApiEndpointSpec[] = [list, get]
