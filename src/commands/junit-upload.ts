import { Arguments, Argv, CommandModule } from 'yargs'
import { parseRunUrl } from '../utils/misc'
import { API_TOKEN } from '../config/env'
import { JUnitCommandHandler } from '../utils/junit/JUnitCommandHandler'

export interface JUnitArgs {
	runUrl: string
	token: string
	files: string[]
	force: boolean
	attachments: boolean
}

export class JUnitUploadCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'junit-upload [args..] <files..>'
	describe = 'upload JUnit xml files'

	builder = (argv: Argv) => {
		argv.options({
			token: {
				alias: 't',
				describe: 'API token',
				type: 'string',
				requiresArg: true,
			},
			'run-url': {
				alias: 'r',
				describe: 'URL of the Run (from QASphere) for uploading results',
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
			return !!parseRunUrl(args)
		})

		argv.check((args) => {
			if (!args.token && !API_TOKEN) {
				throw new Error('-t <token> or QAS_TOKEN environment variable must be present')
			}
			return true
		})

		argv.example(
			'$0 junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 -t API_TOKEN ./path/to/junit.xml',
			'Upload JUnit xml file to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		argv.example(
			'$0 junit-upload --run-url https://qas.eu1.qasphere.com/project/P1/run/23 --token API_TOKEN *.xml',
			'Upload all xml files in the current directory to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		const handler = new JUnitCommandHandler(args)
		await handler.handle()
	}
}
