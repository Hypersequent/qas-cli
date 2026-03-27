import { Argv, CommandModule } from 'yargs'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	printJson,
	validateIntId,
	type SortOrder,
} from '../utils'
import help from './help'

interface SharedPreconditionsListArgs {
	'project-code': string
	'sort-field'?: string
	'sort-order'?: string
	include?: string
}

const listCommand: CommandModule<object, SharedPreconditionsListArgs> = {
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
				'sort-field': {
					type: 'string',
					choices: ['created_at', 'title'],
					describe: help.list['sort-field'],
				},
				'sort-order': {
					type: 'string',
					choices: ['asc', 'desc'],
					describe: help.list['sort-order'],
				},
				include: {
					type: 'string',
					describe: help.list.include,
				},
			})
			.epilog(help.list.epilog),
	handler: apiHandler<SharedPreconditionsListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.sharedPreconditions
			.list(args['project-code'], {
				...args,
				sortField: args['sort-field'],
				sortOrder: args['sort-order'] as SortOrder,
			})
			.catch(handleValidationError(buildArgumentMap(['sort-field', 'sort-order', 'include'])))
		printJson(result)
	}),
}

interface SharedPreconditionsGetArgs {
	'project-code': string
	id: number
}

const getCommand: CommandModule<object, SharedPreconditionsGetArgs> = {
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
				id: {
					type: 'number',
					demandOption: true,
					describe: help.get.id,
				},
			})
			.epilog(help.get.epilog)
			.check((argv) => {
				validateIntId([argv.id, '--id'])
				return true
			}),
	handler: apiHandler<SharedPreconditionsGetArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.sharedPreconditions.get(args['project-code'], args.id)
		printJson(result)
	}),
}

export const sharedPreconditionsCommand: CommandModule = {
	command: 'shared-preconditions',
	describe: 'Manage shared preconditions',
	builder: (yargs: Argv) => yargs.command(listCommand).command(getCommand).demandCommand(1, ''),
	handler: () => {},
}
