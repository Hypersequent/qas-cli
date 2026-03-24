import { Argv, CommandModule } from 'yargs'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	parseAndValidateJsonArg,
	printJson,
} from '../utils'
import { updateStatusesInputSchema } from './schemas'
import help from './help'

const listStatusesCommand: CommandModule = {
	command: 'list-statuses',
	describe: help['list-statuses'].command,
	builder: (yargs: Argv) => yargs.epilog(help['list-statuses'].epilog),
	handler: apiHandler(async (_args, connectApi) => {
		const api = connectApi()
		const result = await api.settings.list()
		printJson(result)
	}),
}

interface SettingsUpdateStatusesArgs {
	statuses: string
}

const updateStatusesCommand: CommandModule<object, SettingsUpdateStatusesArgs> = {
	command: 'update-statuses',
	describe: help['update-statuses'].command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				statuses: {
					type: 'string',
					demandOption: true,
					describe: help['update-statuses'].statuses,
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help['update-statuses'].epilog),
	handler: apiHandler<SettingsUpdateStatusesArgs>(async (args, connectApi) => {
		const statuses = parseAndValidateJsonArg(args.statuses, '--statuses', updateStatusesInputSchema)
		const api = connectApi()
		const result = await api.settings
			.update({ statuses })
			.catch(handleValidationError(buildArgumentMap(['statuses'])))
		printJson(result)
	}),
}

export const settingsCommand: CommandModule = {
	command: 'settings',
	describe: 'Manage settings',
	builder: (yargs: Argv) =>
		yargs.command(listStatusesCommand).command(updateStatusesCommand).demandCommand(1, ''),
	handler: () => {},
}
