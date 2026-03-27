import { Argv, CommandModule } from 'yargs'
import { z } from 'zod'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	parseAndValidateJsonArg,
	parseOptionalJsonField,
	printJson,
	type SortOrder,
	validateResourceId,
} from '../utils'
import {
	type CreateTCaseRequest,
	customFieldsSchema,
	parameterValueSchema,
	parameterValueWithIdSchema,
	StepsArraySchema,
	type UpdateTCaseRequest,
} from '../../../api/tcases'
import help from './help'

function mergeBodyWithOverrides(
	bodyArg: string | undefined,
	overrides: Record<string, unknown>
): Record<string, unknown> {
	const bodyFromJson = bodyArg
		? parseAndValidateJsonArg(bodyArg, '--body', z.record(z.unknown()))
		: {}
	return {
		...bodyFromJson,
		...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
	}
}

interface TCasesListArgs {
	'project-code': string
	page?: number
	limit?: number
	folders?: string
	tags?: string
	priorities?: string
	search?: string
	types?: string
	draft?: boolean
	'sort-field'?: string
	'sort-order'?: string
	include?: string
}

const listCommand: CommandModule<object, TCasesListArgs> = {
	command: 'list',
	describe: help.list.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				page: { type: 'number', describe: help.list.page },
				limit: { type: 'number', describe: help.list.limit },
				folders: { type: 'string', describe: help.list.folders },
				tags: { type: 'string', describe: help.list.tags },
				priorities: { type: 'string', describe: help.list.priorities },
				search: { type: 'string', describe: help.list.search },
				types: { type: 'string', describe: help.list.types },
				draft: { type: 'boolean', describe: help.draft },
				'sort-field': { type: 'string', describe: help.list['sort-field'] },
				'sort-order': {
					type: 'string',
					choices: ['asc', 'desc'],
					describe: help.list['sort-order'],
				},
				include: { type: 'string', describe: help.list.include },
			})
			.epilog(help.list.epilog),
	handler: apiHandler<TCasesListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.testCases
			.list(args['project-code'], {
				...args,
				sortField: args['sort-field'],
				sortOrder: args['sort-order'] as SortOrder,
				folders: args.folders?.split(',').map(Number),
				tags: args.tags?.split(',').map(Number),
				priorities: args.priorities?.split(','),
				types: args.types?.split(','),
				include: args.include?.split(','),
			})
			.catch(
				handleValidationError(
					buildArgumentMap([
						'page',
						'limit',
						'search',
						'draft',
						'include',
						'sort-field',
						'sort-order',
						'folders',
						'tags',
						'priorities',
						'types',
					])
				)
			)
		printJson(result)
	}),
}

interface TCasesGetArgs {
	'project-code': string
	'tcase-id': string
}

const getCommand: CommandModule<object, TCasesGetArgs> = {
	command: 'get',
	describe: help.get.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'tcase-id': {
					type: 'string',
					demandOption: true,
					describe: help['tcase-id'],
				},
			})
			.epilog(help.get.epilog)
			.check((argv) => {
				validateResourceId([argv['tcase-id'], '--tcase-id'])
				return true
			}),
	handler: apiHandler<TCasesGetArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.testCases.get(args['project-code'], args['tcase-id'])
		printJson(result)
	}),
}

interface TCasesCountArgs {
	'project-code': string
	folders?: string
	recursive?: boolean
	tags?: string
	priorities?: string
	draft?: boolean
}

const countCommand: CommandModule<object, TCasesCountArgs> = {
	command: 'count',
	describe: help.count.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				folders: { type: 'string', describe: help.count.folders },
				recursive: { type: 'boolean', describe: help.count.recursive },
				tags: { type: 'string', describe: help.count.tags },
				priorities: { type: 'string', describe: help.count.priorities },
				draft: { type: 'boolean', describe: help.draft },
			})
			.epilog(help.count.epilog),
	handler: apiHandler<TCasesCountArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.testCases
			.count(args['project-code'], {
				...args,
				folders: args.folders?.split(',').map(Number),
				tags: args.tags?.split(',').map(Number),
				priorities: args.priorities?.split(','),
			})
			.catch(
				handleValidationError(
					buildArgumentMap(['folders', 'tags', 'priorities', 'recursive', 'draft'])
				)
			)
		printJson(result)
	}),
}

interface TCasesCreateArgs {
	'project-code': string
	body?: string
	title?: string
	type?: string
	'folder-id'?: number
	priority?: string
	'precondition-text'?: string
	'precondition-id'?: number
	tags?: string
	'is-draft'?: boolean
	steps?: string
	'custom-fields'?: string
	'parameter-values'?: string
}

const createCommand: CommandModule<object, TCasesCreateArgs> = {
	command: 'create',
	describe: help.create.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				body: {
					type: 'string',
					describe: help.create.body,
				},
				title: {
					type: 'string',
					describe: help.title,
				},
				type: {
					type: 'string',
					choices: ['standalone', 'template'],
					describe: help.create.type,
				},
				'folder-id': {
					type: 'number',
					describe: help.create['folder-id'],
				},
				priority: {
					type: 'string',
					choices: ['low', 'medium', 'high'],
					describe: help.priority,
				},
				'precondition-text': {
					type: 'string',
					describe: help['precondition-text'],
				},
				'precondition-id': {
					type: 'number',
					describe: help['precondition-id'],
				},
				tags: {
					type: 'string',
					describe: help.tags,
				},
				'is-draft': {
					type: 'boolean',
					describe: help['is-draft'],
				},
				steps: {
					type: 'string',
					describe: help.steps,
				},
				'custom-fields': {
					type: 'string',
					describe: help['custom-fields'],
				},
				'parameter-values': {
					type: 'string',
					describe: help['parameter-values'],
				},
			})
			.check((argv) => {
				if (argv['precondition-text'] && argv['precondition-id']) {
					throw new Error('--precondition-text and --precondition-id are mutually exclusive')
				}
				return argv.body || argv.title ? true : 'Either --body or --title is required'
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<TCasesCreateArgs>(async (args, connectApi) => {
		const precondition = args['precondition-text']
			? { text: args['precondition-text'] }
			: args['precondition-id']
				? { sharedPreconditionId: args['precondition-id'] }
				: undefined
		const body = mergeBodyWithOverrides(args.body, {
			title: args.title,
			type: args.type,
			folderId: args['folder-id'],
			priority: args.priority,
			precondition,
			isDraft: args['is-draft'],
			tags: args.tags?.split(','),
			steps: parseOptionalJsonField(args.steps, '--steps', StepsArraySchema),
			customFields: parseOptionalJsonField(
				args['custom-fields'],
				'--custom-fields',
				customFieldsSchema
			),
			parameterValues: parseOptionalJsonField(
				args['parameter-values'],
				'--parameter-values',
				z.array(parameterValueSchema)
			),
		})
		const api = connectApi()
		const result = await api.testCases
			.create(args['project-code'], body as CreateTCaseRequest)
			.catch(
				handleValidationError(
					buildArgumentMap([
						'title',
						'type',
						'folder-id',
						'priority',
						'is-draft',
						'tags',
						'steps',
						'custom-fields',
						'parameter-values',
					])
				)
			)
		printJson(result)
	}),
}

interface TCasesUpdateArgs {
	'project-code': string
	'tcase-id': string
	body?: string
	title?: string
	priority?: string
	'precondition-text'?: string
	'precondition-id'?: number
	tags?: string
	'is-draft'?: boolean
	steps?: string
	'custom-fields'?: string
	'parameter-values'?: string
}

const updateCommand: CommandModule<object, TCasesUpdateArgs> = {
	command: 'update',
	describe: help.update.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'tcase-id': {
					type: 'string',
					demandOption: true,
					describe: help['tcase-id'],
				},
				body: {
					type: 'string',
					describe: help.update.body,
				},
				title: {
					type: 'string',
					describe: help.title,
				},
				priority: {
					type: 'string',
					choices: ['low', 'medium', 'high'],
					describe: help.priority,
				},
				'precondition-text': {
					type: 'string',
					describe: help['precondition-text'],
				},
				'precondition-id': {
					type: 'number',
					describe: help['precondition-id'],
				},
				tags: {
					type: 'string',
					describe: help.tags,
				},
				'is-draft': {
					type: 'boolean',
					describe: help['is-draft'],
				},
				steps: {
					type: 'string',
					describe: help.steps,
				},
				'custom-fields': {
					type: 'string',
					describe: help['custom-fields'],
				},
				'parameter-values': {
					type: 'string',
					describe: help['parameter-values'],
				},
			})
			.check((argv) => {
				if (argv['precondition-text'] && argv['precondition-id']) {
					throw new Error('--precondition-text and --precondition-id are mutually exclusive')
				}
				validateResourceId([argv['tcase-id'], '--tcase-id'])
				return true
			})
			.epilog(help.update.epilog),
	handler: apiHandler<TCasesUpdateArgs>(async (args, connectApi) => {
		const precondition = args['precondition-text']
			? { text: args['precondition-text'] }
			: args['precondition-id']
				? { sharedPreconditionId: args['precondition-id'] }
				: undefined
		const body = mergeBodyWithOverrides(args.body, {
			title: args.title,
			priority: args.priority,
			precondition,
			isDraft: args['is-draft'],
			tags: args.tags?.split(','),
			steps: parseOptionalJsonField(args.steps, '--steps', StepsArraySchema),
			customFields: parseOptionalJsonField(
				args['custom-fields'],
				'--custom-fields',
				customFieldsSchema
			),
			parameterValues: parseOptionalJsonField(
				args['parameter-values'],
				'--parameter-values',
				z.array(parameterValueWithIdSchema)
			),
		})
		const updateFields = [
			'title',
			'priority',
			'is-draft',
			'tags',
			'steps',
			'custom-fields',
			'parameter-values',
		]
		if (Object.keys(body).length === 0) {
			const fieldList = updateFields.map((f) => `--${f}`).join(', ')
			throw new Error(`At least one field to update is required (--body, ${fieldList})`)
		}
		const api = connectApi()
		const result = await api.testCases
			.update(args['project-code'], args['tcase-id'], body as UpdateTCaseRequest)
			.catch(handleValidationError(buildArgumentMap(updateFields)))
		printJson(result)
	}),
}

export const testCasesCommand: CommandModule = {
	command: 'test-cases',
	describe: 'Manage test cases',
	builder: (yargs: Argv) =>
		yargs
			.command(listCommand)
			.command(getCommand)
			.command(countCommand)
			.command(createCommand)
			.command(updateCommand)
			.demandCommand(1, ''),
	handler: () => {},
}
