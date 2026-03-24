import { Argv, CommandModule } from 'yargs'
import {
	apiHandler,
	buildArgumentMap,
	handleValidationError,
	parseAndValidateJsonArg,
	parseOptionalJsonField,
	printJson,
	validatePathParams,
} from '../utils'
import { type CreateResultRequest, resultLinksSchema } from '../../../api/results'
import { batchCreateResultsInputSchema } from './schemas'
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
			.epilog(help.create.epilog)
			.check((argv) => {
				validatePathParams([argv['tcase-id'], '--tcase-id'])
				return true
			}),
	handler: apiHandler<ResultsCreateArgs>(async (args, connectApi) => {
		const links = parseOptionalJsonField(args.links, '--links', resultLinksSchema)
		const api = connectApi()
		const result = await api.results
			.create(args['project-code'], args['run-id'], args['tcase-id'], {
				...args,
				status: args.status as CreateResultRequest['status'],
				timeTaken: args['time-taken'],
				links,
			})
			.catch(handleValidationError(buildArgumentMap(['status', 'comment', 'time-taken', 'links'])))
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
		const result = await api.results
			.createBatch(args['project-code'], args['run-id'], body)
			.catch(handleValidationError(buildArgumentMap(['items'])))
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
