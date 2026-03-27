import { Argv, CommandModule } from 'yargs'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	parseAndValidateJsonArg,
	printJson,
	type SortOrder,
	validateIntId,
	validateResourceId,
} from '../utils'
import { QueryPlansSchema, type ListRunTCasesRequest } from '../../../api/runs'
import help from './help'

interface RunsCreateArgs {
	'project-code': string
	title: string
	type: 'static' | 'static_struct' | 'live'
	description?: string
	'milestone-id'?: number
	'configuration-id'?: string
	'assignment-id'?: number
	'query-plans': string
}

const createCommand: CommandModule<object, RunsCreateArgs> = {
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
				title: {
					type: 'string',
					demandOption: true,
					describe: help.create.title,
				},
				type: {
					type: 'string',
					demandOption: true,
					choices: ['static', 'static_struct', 'live'] as const,
					describe: help.create.type,
				},
				description: {
					type: 'string',
					describe: help.create.description,
				},
				'milestone-id': {
					type: 'number',
					describe: help.create['milestone-id'],
				},
				'configuration-id': {
					type: 'string',
					describe: help.create['configuration-id'],
				},
				'assignment-id': {
					type: 'number',
					describe: help.create['assignment-id'],
				},
				'query-plans': {
					type: 'string',
					demandOption: true,
					describe: help.create['query-plans'],
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<RunsCreateArgs>(async (args, connectApi) => {
		const queryPlans = parseAndValidateJsonArg(
			args['query-plans'],
			'--query-plans',
			QueryPlansSchema
		)
		const api = connectApi()
		const result = await api.runs
			.create(args['project-code'], {
				...args,
				milestoneId: args['milestone-id'],
				configurationId: args['configuration-id'],
				assignmentId: args['assignment-id'],
				queryPlans,
			})
			.catch(
				handleValidationError(
					buildArgumentMap([
						'title',
						'description',
						'type',
						'milestone-id',
						'configuration-id',
						'assignment-id',
						'query-plans',
					])
				)
			)
		printJson(result)
	}),
}

interface RunsListArgs {
	'project-code': string
	closed?: boolean
	'milestone-ids'?: string
	limit?: number
}

const listCommand: CommandModule<object, RunsListArgs> = {
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
				closed: {
					type: 'boolean',
					describe: help.list.closed,
				},
				'milestone-ids': {
					type: 'string',
					describe: help.list['milestone-ids'],
				},
				limit: {
					type: 'number',
					describe: help.list.limit,
				},
			})
			.epilog(help.list.epilog),
	handler: apiHandler<RunsListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.runs
			.list(args['project-code'], {
				...args,
				milestoneIds: args['milestone-ids']?.split(',').map(Number),
			})
			.catch(handleValidationError(buildArgumentMap(['closed', 'milestone-ids', 'limit'])))
		printJson(result)
	}),
}

interface RunsCloneArgs {
	'project-code': string
	'run-id': number
	title: string
	description?: string
	'milestone-id'?: number
	'assignment-id'?: number
}

const cloneCommand: CommandModule<object, RunsCloneArgs> = {
	command: 'clone',
	describe: help.clone.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'run-id': {
					type: 'number',
					demandOption: true,
					describe: help['run-id'],
				},
				title: {
					type: 'string',
					demandOption: true,
					describe: help.clone.title,
				},
				description: {
					type: 'string',
					describe: help.clone.description,
				},
				'milestone-id': {
					type: 'number',
					describe: help.clone['milestone-id'],
				},
				'assignment-id': {
					type: 'number',
					describe: help.clone['assignment-id'],
				},
			})
			.epilog(help.clone.epilog)
			.check((argv) => {
				validateIntId([argv['run-id'], '--run-id'])
				return true
			}),
	handler: apiHandler<RunsCloneArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.runs
			.clone(args['project-code'], {
				...args,
				runId: args['run-id'],
				milestoneId: args['milestone-id'],
				assignmentId: args['assignment-id'],
			})
			.catch(
				handleValidationError(
					buildArgumentMap(['run-id', 'title', 'description', 'milestone-id', 'assignment-id'])
				)
			)
		printJson(result)
	}),
}

interface RunsCloseArgs {
	'project-code': string
	'run-id': number
}

const closeCommand: CommandModule<object, RunsCloseArgs> = {
	command: 'close',
	describe: help.close.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'run-id': {
					type: 'number',
					demandOption: true,
					describe: help['run-id'],
				},
			})
			.epilog(help.close.epilog)
			.check((argv) => {
				validateIntId([argv['run-id'], '--run-id'])
				return true
			}),
	handler: apiHandler<RunsCloseArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.runs.close(args['project-code'], args['run-id'])
		printJson(result)
	}),
}

// Nested tcases subgroup

interface RunsTCasesListArgs {
	'project-code': string
	'run-id': number
	search?: string
	tags?: string
	priorities?: string
	include?: string
	'sort-field'?: string
	'sort-order'?: string
}

const tcasesListCommand: CommandModule<object, RunsTCasesListArgs> = {
	command: 'list',
	describe: help.tcases.list.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'run-id': {
					type: 'number',
					demandOption: true,
					describe: help['run-id'],
				},
				search: {
					type: 'string',
					describe: help.tcases.list.search,
				},
				tags: {
					type: 'string',
					describe: help.tcases.list.tags,
				},
				priorities: {
					type: 'string',
					describe: help.tcases.list.priorities,
				},
				include: {
					type: 'string',
					describe: help.tcases.list.include,
				},
				'sort-field': {
					type: 'string',
					describe: help.tcases.list['sort-field'],
				},
				'sort-order': {
					type: 'string',
					choices: ['asc', 'desc'],
					describe: help.tcases.list['sort-order'],
				},
			})
			.epilog(help.tcases.list.epilog)
			.check((argv) => {
				validateIntId([argv['run-id'], '--run-id'])
				return true
			}),
	handler: apiHandler<RunsTCasesListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.runs
			.listTCases(args['project-code'], args['run-id'], {
				...args,
				sortField: args['sort-field'],
				sortOrder: args['sort-order'] as SortOrder,
				tags: args.tags?.split(',').map(Number),
				priorities: args.priorities?.split(',') as ListRunTCasesRequest['priorities'],
			})
			.catch(
				handleValidationError(
					buildArgumentMap(['search', 'tags', 'priorities', 'include', 'sort-field', 'sort-order'])
				)
			)
		printJson(result)
	}),
}

interface RunsTCasesGetArgs {
	'project-code': string
	'run-id': number
	'tcase-id': string
}

const tcasesGetCommand: CommandModule<object, RunsTCasesGetArgs> = {
	command: 'get',
	describe: help.tcases.get.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				'run-id': {
					type: 'number',
					demandOption: true,
					describe: help['run-id'],
				},
				'tcase-id': {
					type: 'string',
					demandOption: true,
					describe: help.tcases.get['tcase-id'],
				},
			})
			.epilog(help.tcases.get.epilog)
			.check((argv) => {
				validateIntId([argv['run-id'], '--run-id'])
				validateResourceId([argv['tcase-id'], '--tcase-id'])
				return true
			}),
	handler: apiHandler<RunsTCasesGetArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.runs.getTCase(args['project-code'], args['run-id'], args['tcase-id'])
		printJson(result)
	}),
}

const tcasesCommand: CommandModule = {
	command: 'tcases',
	describe: help.tcases.command,
	builder: (yargs: Argv) =>
		yargs.command(tcasesListCommand).command(tcasesGetCommand).demandCommand(1, ''),
	handler: () => {},
}

export const runsCommand: CommandModule = {
	command: 'runs',
	describe: 'Manage test runs',
	builder: (yargs: Argv) =>
		yargs
			.command(createCommand)
			.command(listCommand)
			.command(cloneCommand)
			.command(closeCommand)
			.command(tcasesCommand)
			.demandCommand(1, ''),
	handler: () => {},
}
