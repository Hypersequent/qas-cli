import { Argv, CommandModule } from 'yargs'
import { apiHandler, parseAndValidateJsonArg, printJson } from '../utils'
import { createTestPlanBodySchema } from './schemas'
import help from './help'

interface TestPlansCreateArgs {
	'project-code': string
	body: string
}

const createCommand: CommandModule<object, TestPlansCreateArgs> = {
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
					demandOption: true,
					describe: help.create.body,
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<TestPlansCreateArgs>(async (args, connectApi) => {
		const body = parseAndValidateJsonArg(args.body, '--body', createTestPlanBodySchema)
		const api = connectApi()
		const result = await api.testPlans.createTestPlan(args['project-code'], body)
		printJson(result)
	}),
}

export const testPlansCommand: CommandModule = {
	command: 'test-plans',
	describe: 'Manage test plans',
	builder: (yargs: Argv) => yargs.command(createCommand).demandCommand(1, ''),
	handler: () => {},
}
