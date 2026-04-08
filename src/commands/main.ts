import yargs from 'yargs'
import { ResultUploadCommandModule } from './resultUpload'
import { authCommand } from './auth'
import { qasEnvs, qasEnvFile } from '../utils/env'
import { CLI_VERSION } from '../utils/version'

export const run = (args: string | string[]) =>
	yargs(args)
		.usage(
			`$0 <command> [options]

Authenticate using: $0 auth login
Or set variables: ${qasEnvs.join(', ')}
  These should be either exported as env vars or defined in a ${qasEnvFile} file.`
		)
		.command(authCommand)
		.command(new ResultUploadCommandModule('junit-upload'))
		.command(new ResultUploadCommandModule('playwright-json-upload'))
		.command(new ResultUploadCommandModule('allure-upload'))
		.demandCommand(1, '')
		.help('h')
		.alias('h', 'help')
		.version(CLI_VERSION)
		.options({
			verbose: {
				type: 'boolean',
				describe: 'Show verbose errors',
			},
		})
		.wrap(null)
		.strict()
		.showHelpOnFail(false) // this shows help even if the command itself is failing
		.fail((msg, err, yi) => {
			// if no command is provided, show help and exit
			if (args.length === 0) {
				yi.showHelp()
				process.exit(0)
			} else {
				if (msg) {
					console.error(msg)
					if (
						msg.startsWith('Unknown argument') ||
						msg.startsWith('Not enough non-option arguments')
					) {
						yi.showHelp()
						process.exit(0)
					}
				} else if (err && err.message) {
					console.error(err.message)
				} else if (err) {
					console.error(String(err))
				} else {
					console.error('An unexpected error occurred.')
				}
				process.exit(1)
			}
		})
		.parse()
