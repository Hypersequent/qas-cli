import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

const listCommand: CommandModule = {
	command: 'list',
	describe: help.list.command,
	builder: (yargs: Argv) => yargs.epilog(help.list.epilog),
	handler: apiHandler(async (_args, connectApi) => {
		const api = connectApi()
		const result = await api.users.list()
		printJson(result)
	}),
}

export const usersCommand: CommandModule = {
	command: 'users',
	describe: 'Manage users',
	builder: (yargs: Argv) => yargs.command(listCommand).demandCommand(1, ''),
	handler: () => {},
}
