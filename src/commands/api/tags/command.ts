import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

interface TagsListArgs {
	'project-code': string
}

const listCommand: CommandModule<object, TagsListArgs> = {
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
	handler: apiHandler<TagsListArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.tags.list(args['project-code'])
		printJson(result)
	}),
}

export const tagsCommand: CommandModule = {
	command: 'tags',
	describe: 'Manage tags',
	builder: (yargs: Argv) => yargs.command(listCommand).demandCommand(1, ''),
	handler: () => {},
}
