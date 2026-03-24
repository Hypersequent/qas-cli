import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

interface CustomFieldsListArgs {
	'project-code': string
}

const listCommand: CommandModule<object, CustomFieldsListArgs> = {
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
			})
			.epilog(help.list.epilog),
	handler: apiHandler<CustomFieldsListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.customFields.list(args['project-code'])
		printJson(result)
	}),
}

export const customFieldsCommand: CommandModule = {
	command: 'custom-fields',
	describe: 'Manage custom fields',
	builder: (yargs: Argv) => yargs.command(listCommand).demandCommand(1, ''),
	handler: () => {},
}
