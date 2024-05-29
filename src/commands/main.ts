import yargs from 'yargs'
import { JUnitUploadCommandModule } from './junit-upload'

export const run = (args: string | string[]) =>
	yargs(args)
		.usage('$0 <command> [options]')
		.command(new JUnitUploadCommandModule())
		.demandCommand()
		.help('h')
		.alias('h', 'help')
		.wrap(null)
		.parse()
