import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson, validateWithSchema } from '../utils'
import { createMilestoneBodySchema } from './schemas'
import help from './help'

interface MilestonesListArgs {
	'project-code': string
	archived?: boolean
}

const listCommand: CommandModule<object, MilestonesListArgs> = {
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
				archived: {
					type: 'boolean',
					describe: help.list.archived,
				},
			})
			.epilog(help.list.epilog),
	handler: apiHandler<MilestonesListArgs>(async (args, connectApi) => {
		const { 'project-code': projectCode, ...rest } = args
		const api = connectApi()
		const result = await api.milestones.list(projectCode, rest)
		printJson(result)
	}),
}

interface MilestonesCreateArgs {
	'project-code': string
	title: string
}

const createCommand: CommandModule<object, MilestonesCreateArgs> = {
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
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<MilestonesCreateArgs>(async (args, connectApi) => {
		const body = validateWithSchema(
			{ title: args.title },
			'request body',
			createMilestoneBodySchema
		)
		const api = connectApi()
		const result = await api.milestones.create(args['project-code'], body)
		printJson(result)
	}),
}

export const milestonesCommand: CommandModule = {
	command: 'milestones',
	describe: 'Manage milestones',
	builder: (yargs: Argv) => yargs.command(listCommand).command(createCommand).demandCommand(1, ''),
	handler: () => {},
}
