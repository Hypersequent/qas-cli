import { Argv, CommandModule } from 'yargs'
import { apiHandler, parseAndValidateJsonArg, printJson } from '../utils'
import { bulkCreateFoldersSchema } from './schemas'
import help from './help'

interface FoldersListArgs {
	'project-code': string
	page?: number
	limit?: number
	'sort-field'?: string
	'sort-order'?: string
}

const listCommand: CommandModule<object, FoldersListArgs> = {
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
				page: {
					type: 'number',
					describe: help.list.page,
				},
				limit: {
					type: 'number',
					describe: help.list.limit,
				},
				'sort-field': {
					type: 'string',
					choices: ['id', 'project_id', 'title', 'pos', 'parent_id', 'created_at', 'updated_at'],
					describe: help.list['sort-field'],
				},
				'sort-order': {
					type: 'string',
					choices: ['asc', 'desc'],
					describe: help.list['sort-order'],
				},
			})
			.epilog(help.list.epilog),
	handler: apiHandler<FoldersListArgs>(async (args, connectApi) => {
		const {
			'project-code': projectCode,
			'sort-field': sortField,
			'sort-order': sortOrder,
			...rest
		} = args
		const api = connectApi()
		const result = await api.folders.getPaginated(projectCode, {
			...rest,
			sortField,
			sortOrder,
		})
		printJson(result)
	}),
}

interface FoldersBulkCreateArgs {
	'project-code': string
	folders: string
}

const bulkCreateCommand: CommandModule<object, FoldersBulkCreateArgs> = {
	command: 'bulk-create',
	describe: help['bulk-create'].command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
				folders: {
					type: 'string',
					demandOption: true,
					describe: help['bulk-create'].folders,
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help['bulk-create'].epilog),
	handler: apiHandler<FoldersBulkCreateArgs>(async (args, connectApi) => {
		const body = parseAndValidateJsonArg(args.folders, '--folders', bulkCreateFoldersSchema)
		const api = connectApi()
		const result = await api.folders.bulkCreate(args['project-code'], body)
		printJson(result)
	}),
}

export const foldersCommand: CommandModule = {
	command: 'folders',
	describe: 'Manage folders',
	builder: (yargs: Argv) =>
		yargs.command(listCommand).command(bulkCreateCommand).demandCommand(1, ''),
	handler: () => {},
}
