import yargs from 'yargs'
import { JUnitUploadCommandModule } from './junit-upload'
import { NewJUnitTestRunCommandModule } from './new-junit-upload'
import { qasEnvs, qasEnvFile } from '../utils/env'

export const run = (args: string | string[]) =>
	yargs(args)
		.usage(
			`$0 <command> [options]

Required variables: ${qasEnvs.join(', ')}
  These should be either exported as environment variables or defined in a ${qasEnvFile} file in the current directory or one of its parents.`
		)
		.command(new JUnitUploadCommandModule())
		.command(new NewJUnitTestRunCommandModule())
		.demandCommand()
		.help('h')
		.alias('h', 'help')
		.options({
			verbose: {
				type: 'boolean',
				describe: 'Show verbose errors',
			},
		})
		.wrap(null)
		.strict()
		.parse()
