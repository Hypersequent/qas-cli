import { Argv, CommandModule } from 'yargs'
import { apiHandler, parseAndValidateJsonArg, printJson, validateWithSchema } from '../utils'
import { batchCreateResultsInputSchema, createResultBodySchema, resultLinksSchema } from './schemas'
import help from './help'

interface ResultsCreateArgs {
	'project-code': string
	'run-id': number
	'tcase-id': string
	status: string
	comment?: string
	'time-taken'?: number
	links?: string
}

const createCommand: CommandModule<object, ResultsCreateArgs> = {
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
				'run-id': {
					type: 'number',
					demandOption: true,
					describe: help['run-id'],
				},
				'tcase-id': {
					type: 'string',
					demandOption: true,
					describe: help.create['tcase-id'],
				},
				status: {
					type: 'string',
					demandOption: true,
					choices: [
						'passed',
						'failed',
						'blocked',
						'skipped',
						'open',
						'custom1',
						'custom2',
						'custom3',
						'custom4',
					],
					describe: help.create.status,
				},
				comment: {
					type: 'string',
					describe: help.create.comment,
				},
				'time-taken': {
					type: 'number',
					describe: help.create['time-taken'],
				},
				links: {
					type: 'string',
					describe: help.create.links,
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog),
	handler: apiHandler<ResultsCreateArgs>(async (args, connectApi) => {
		const {
			'project-code': projectCode,
			'run-id': runId,
			'tcase-id': tcaseId,
			'time-taken': timeTaken,
			links: linksArg,
			...restArgs
		} = args
		const links = linksArg
			? parseAndValidateJsonArg(linksArg, '--links', resultLinksSchema)
			: undefined

		const body = validateWithSchema(
			{ ...restArgs, timeTaken, links },
			'request body',
			createResultBodySchema
		)

		const api = connectApi()
		const result = await api.results.createResult(projectCode, runId, tcaseId, body)
		printJson(result)
	}),
}

interface ResultsBatchCreateArgs {
	'project-code': string
	'run-id': number
	items: string
}

const batchCreateCommand: CommandModule<object, ResultsBatchCreateArgs> = {
	command: 'batch-create',
	describe: help['batch-create'].command,
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
				items: {
					type: 'string',
					demandOption: true,
					describe: help['batch-create'].items,
				},
			})
			.epilog(help['batch-create'].epilog),
	handler: apiHandler<ResultsBatchCreateArgs>(async (args, connectApi) => {
		const body = parseAndValidateJsonArg(args.items, '--items', batchCreateResultsInputSchema)
		const api = connectApi()
		const result = await api.results.createResults(args['project-code'], args['run-id'], body)
		printJson(result)
	}),
}

export const resultsCommand: CommandModule = {
	command: 'results',
	describe: 'Manage test results',
	builder: (yargs: Argv) =>
		yargs.command(createCommand).command(batchCreateCommand).demandCommand(1, ''),
	handler: () => {},
}
