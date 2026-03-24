import { Argv, CommandModule } from 'yargs'
import { z } from 'zod'
import {
	apiHandler,
	parseAndValidateJsonArg,
	printJson,
	validatePathParams,
	validateWithSchema,
} from '../utils'
import { createTCaseBodySchema, stepsArraySchema, updateTCaseBodySchema } from './schemas'
import help from './help'

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
		const {
			'project-code': projectCode,
			'sort-field': sortField,
			'sort-order': sortOrder,
			...rest
		} = args
		const api = connectApi()
		const result = await api.testCases.list(projectCode, {
			...rest,
			sortField,
			sortOrder,
			folders: args.folders?.split(',').map(Number),
			tags: args.tags?.split(',').map(Number),
			priorities: args.priorities?.split(','),
			types: args.types?.split(','),
		})
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
				validatePathParams([argv['tcase-id'], '--tcase-id'])
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
		const { 'project-code': projectCode, ...rest } = args
		const api = connectApi()
		const result = await api.testCases.count(projectCode, {
			...rest,
			folders: args.folders?.split(',').map(Number),
			tags: args.tags?.split(',').map(Number),
			priorities: args.priorities?.split(','),
		})
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
	comment?: string
	tags?: string
	'is-draft'?: boolean
	steps?: string
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
				comment: {
					type: 'string',
					describe: help.comment,
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
			})
			.check((argv) => {
				return argv.body || argv.title ? true : 'Either --body or --title is required'
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<TCasesCreateArgs>(async (args, connectApi) => {
		const {
			'project-code': projectCode,
			'folder-id': folderId,
			'is-draft': isDraft,
			body: bodyArg,
			steps: stepsArg,
			tags,
			...restArgs
		} = args
		const bodyFromJson = bodyArg
			? parseAndValidateJsonArg(bodyArg, '--body', z.record(z.unknown()))
			: {}

		const steps = stepsArg
			? parseAndValidateJsonArg(stepsArg, '--steps', stepsArraySchema)
			: undefined

		const overrides = {
			...restArgs,
			folderId,
			isDraft,
			tags: tags?.split(','),
			steps,
		}
		const merged = {
			...bodyFromJson,
			...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
		}

		const body = validateWithSchema(merged, '--body', createTCaseBodySchema)
		const api = connectApi()
		const result = await api.testCases.create(projectCode, body)
		printJson(result)
	}),
}

interface TCasesUpdateArgs {
	'project-code': string
	'tcase-id': string
	body?: string
	title?: string
	priority?: string
	comment?: string
	tags?: string
	'is-draft'?: boolean
	steps?: string
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
				comment: {
					type: 'string',
					describe: help.comment,
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
			})
			.check((argv) => {
				validatePathParams([argv['tcase-id'], '--tcase-id'])
				return argv.body || argv.title ? true : 'Either --body or --title is required'
			})
			.epilog(help.update.epilog),
	handler: apiHandler<TCasesUpdateArgs>(async (args, connectApi) => {
		const {
			'project-code': projectCode,
			'tcase-id': tcaseId,
			'is-draft': isDraft,
			body: bodyArg,
			steps: stepsArg,
			tags,
			...restArgs
		} = args
		const bodyFromJson = bodyArg
			? parseAndValidateJsonArg(bodyArg, '--body', z.record(z.unknown()))
			: {}

		const steps = stepsArg
			? parseAndValidateJsonArg(stepsArg, '--steps', stepsArraySchema)
			: undefined

		const overrides = {
			...restArgs,
			isDraft,
			tags: tags?.split(','),
			steps,
		}
		const merged = {
			...bodyFromJson,
			...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v !== undefined)),
		}

		const body = validateWithSchema(merged, '--body', updateTCaseBodySchema)
		const api = connectApi()
		const result = await api.testCases.update(projectCode, tcaseId, body)
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
