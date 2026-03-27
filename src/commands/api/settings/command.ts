import { Argv, CommandModule } from 'yargs'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	parseAndValidateJsonArg,
	printJson,
} from '../utils'
import { z } from 'zod'
import help from './help'
import { STATUS_COLORS } from '../../../api/settings'

const statusItemSchema = z.object({
	id: z.enum(['custom1', 'custom2', 'custom3', 'custom4']),
	name: z.string().min(1, 'name must not be empty'),
	color: z.enum(STATUS_COLORS, { message: `color must be one of ${STATUS_COLORS.join(', ')}` }),
	isActive: z.boolean(),
})

const updateStatusesInputSchema = z
	.array(statusItemSchema)
	.min(1, 'Must contain at least one status')

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
