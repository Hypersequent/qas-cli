import {
	CreateSharedStepRequestSchema,
	CreateSubStepsSchema,
	UpdateSubStepsSchema,
	type ListSharedStepsRequest,
} from '../../../api/shared-steps'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, intIdParam, paginationOptions, projectCodeParam } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	id: 'Shared step ID.',
	include: 'Additional fields to include. tcaseCount adds the number of linked test cases.',
	title: 'Shared step title (1-255 characters), unique in the project.',
	'sub-steps':
		'JSON array of sub-steps, in order. Each has optional "description" and "expected" (HTML) and "data" (test data).\nExample: \'[{"description": "Open the login page", "expected": "The form is shown"}]\'',
	'update-sub-steps':
		'JSON array that replaces the sub-steps. Include an existing sub-step\'s "id" to keep it; sub-steps left out are removed.\nExample: \'[{"id": 2, "description": "Open the login page"}, {"description": "New step"}]\'',
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
	create: {
		describe: 'Create a shared step, which test cases reuse through "sharedStepId" in their steps.',
		epilog: apiDocsEpilog('shared_steps', 'create-shared-step'),
		examples: [
			{
				usage:
					'$0 api shared-steps create --project-code PRJ --title "Log in" --sub-steps \'[{"description": "Open the login page"}]\'',
				description: 'Create a shared step',
			},
		],
	},
	update: {
		describe:
			"Update a shared step's title or sub-steps. Every test case that uses it gets a new version.",
		epilog: apiDocsEpilog('shared_steps', 'update-shared-step'),
		examples: [
			{
				usage: '$0 api shared-steps update --project-code PRJ --id 1 --title "Log in as admin"',
				description: 'Rename a shared step',
			},
		],
	},
	delete: {
		describe:
			'Delete a shared step for good. Test cases that use it keep its sub-steps as standalone steps.',
		epilog: apiDocsEpilog('shared_steps', 'delete-shared-step'),
		examples: [
			{
				usage: '$0 api shared-steps delete --project-code PRJ --id 1',
				description: 'Delete a shared step',
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
		...paginationOptions(['created_at', 'title']),
		{ name: 'include', type: 'string', describe: help.include, helpChoices: ['tcaseCount'] },
	],
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.sharedSteps.list(pathParams['project-code'], query as ListSharedStepsRequest)
		)
	},
}

const get: ApiEndpointSpec = {
	id: 'shared-steps.get',
	commandPath: ['shared-steps', 'get'],
	describe: help.get.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	epilog: help.get.epilog,
	examples: help.get.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.sharedSteps.get(pathParams['project-code'], pathParams['id'] as number))
	},
}

const create: ApiEndpointSpec = {
	id: 'shared-steps.create',
	commandPath: ['shared-steps', 'create'],
	describe: help.create.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateSharedStepRequestSchema.shape.title,
		},
		{
			name: 'sub-steps',
			type: 'string',
			describe: help['sub-steps'],
			schema: CreateSubStepsSchema,
			jsonParse: true,
		},
	],
	check: (argv) => {
		return argv.body !== undefined || argv['body-file'] !== undefined || argv.title !== undefined
			? true
			: 'Either --body, --body-file, or --title is required'
	},
	epilog: help.create.epilog,
	examples: help.create.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.sharedSteps.create(
				pathParams['project-code'],
				body as Parameters<typeof api.sharedSteps.create>[1]
			)
		)
	},
}

const update: ApiEndpointSpec = {
	id: 'shared-steps.update',
	commandPath: ['shared-steps', 'update'],
	describe: help.update.describe,
	bodyMode: 'json',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	fieldOptions: [
		{
			name: 'title',
			type: 'string',
			describe: help.title,
			schema: CreateSharedStepRequestSchema.shape.title,
		},
		{
			name: 'sub-steps',
			type: 'string',
			describe: help['update-sub-steps'],
			schema: UpdateSubStepsSchema,
			jsonParse: true,
		},
	],
	check: (argv) => {
		const hasField = ['title', 'sub-steps'].some((f) => argv[f] !== undefined)
		return argv.body !== undefined || argv['body-file'] !== undefined || hasField
			? true
			: 'At least one field to update is required (--body, --body-file, --title, --sub-steps)'
	},
	epilog: help.update.epilog,
	examples: help.update.examples,
	execute: async (api, { pathParams, body }) => {
		printJson(
			await api.sharedSteps.update(
				pathParams['project-code'],
				pathParams['id'] as number,
				body as Parameters<typeof api.sharedSteps.update>[2]
			)
		)
	},
}

const remove: ApiEndpointSpec = {
	id: 'shared-steps.delete',
	commandPath: ['shared-steps', 'delete'],
	describe: help.delete.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam, intIdParam('id', help.id)],
	epilog: help.delete.epilog,
	examples: help.delete.examples,
	execute: async (api, { pathParams }) => {
		printJson(await api.sharedSteps.delete(pathParams['project-code'], pathParams['id'] as number))
	},
}

export const sharedStepSpecs: ApiEndpointSpec[] = [list, get, create, update, remove]
