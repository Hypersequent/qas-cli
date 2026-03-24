import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

interface FilesUploadArgs {
	file: string
}

const uploadCommand: CommandModule<object, FilesUploadArgs> = {
	command: 'upload',
	describe: help.upload.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				file: {
					type: 'string',
					demandOption: true,
					describe: help.upload.file,
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.upload.epilog),
	handler: apiHandler<FilesUploadArgs>(async (args, connectApi) => {
		const fileContent = readFileSync(args.file)
		const filename = basename(args.file)
		const blob = new Blob([fileContent])

		const api = connectApi()
		const [result] = await api.files.upload([{ blob, filename }])
		printJson(result)
	}),
}

export const filesCommand: CommandModule = {
	command: 'files',
	describe: 'Manage file attachments',
	builder: (yargs: Argv) => yargs.command(uploadCommand).demandCommand(1, ''),
	handler: () => {},
}
