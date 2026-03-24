import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

interface RequirementsListArgs {
	'project-code': string
	'sort-field'?: string
	'sort-order'?: string
	include?: string
}

const listCommand: CommandModule<object, RequirementsListArgs> = {
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
					choices: ['created_at', 'text'],
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
	handler: apiHandler<RequirementsListArgs>(async (args, connectApi) => {
		const {
			'project-code': projectCode,
			'sort-field': sortField,
			'sort-order': sortOrder,
			...rest
		} = args
		const api = connectApi()
		const result = await api.requirements.list(projectCode, {
			...rest,
			sortField,
			sortOrder,
		})
		printJson(result)
	}),
}

export const requirementsCommand: CommandModule = {
	command: 'requirements',
	describe: 'Manage requirements',
	builder: (yargs: Argv) => yargs.command(listCommand).demandCommand(1, ''),
	handler: () => {},
}
