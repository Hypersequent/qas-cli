import { Arguments, Argv, CommandModule } from 'yargs'
import { parseUrl } from '../utils/misc'
import { API_TOKEN } from '../config/env'
import { JUnitCommandHandler } from '../utils/junit/JUnitCommandHandler'

export interface JUnitArgs {
	subdomain: string
	zone: string
	project: string
	run: number
	token: string
	file: string
	force: boolean
	attachments: boolean
}

export class JUnitUploadCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'junit-upload [args..] <file>'
	describe = 'upload JUnit xml files'

	builder = (argv: Argv) => {
		argv.options({
			subdomain: {
				alias: 's',
				type: 'string',
				describe: 'URL subdomain',
				requiresArg: true,
			},
			zone: {
				alias: 'z',
				type: 'string',
				describe: 'URL zone',
				requiresArg: true,
			},
			project: {
				alias: 'p',
				type: 'string',
				describe: 'Project code',
				demandOption: true,
				requiresArg: true,
			},
			run: {
				alias: 'r',
				type: 'number',
				describe: 'Run ID',
				demandOption: true,
				requiresArg: true,
			},
			token: {
				alias: 't',
				describe: 'API token',
				type: 'string',
				requiresArg: true,
			},
			url: {
				describe: 'Instance URL',
				type: 'string',
				requiresArg: true,
			},
			attachments: {
				describe: 'Try to detect any attachments and upload it with the test result',
				type: 'boolean',
			},
			force: {
				describe: 'Ignore API request errors, invalid test cases or attachments',
				type: 'boolean',
			},
			help: {
				alias: 'h',
				help: true,
			},
		})

		argv.check((args) => {
			return !!parseUrl(args)
		})

		argv.check((args) => {
			if (!args.token && !API_TOKEN) {
				throw new Error('-t <token> or QAS_TOKEN environment variable must be present')
			}
			return true
		})

		argv.example(
			'$0 junit-upload -s qas -z eu1 -p P1 -r 23 -t API_TOKEN ./path/to/junit.xml ',
			'Upload JUnit xml file to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		argv.example(
			'$0 junit-upload --url qas.eu1.hpsq.io -p P1 -r 23 -t API_TOKEN  ./path/to/junit.xml',
			'Upload JUnit xml file to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		const handler = new JUnitCommandHandler(args)
		await handler.handle()
	}
}
