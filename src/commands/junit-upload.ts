import { Arguments, Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { JUnitResultUploader } from '../utils/junit/JUnitResultUploader'
import { loadEnvs } from '../utils/env'

export interface JUnitArgs {
	runUrl?: string
	token: string
	files: string[]
	force: boolean
	attachments: boolean
}

export class JUnitUploadCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'junit-upload [args..] <files..>'
	describe = 'Upload JUnit xml files to a new or existing test run'

	builder = (argv: Argv) => {
		argv.options({
			'run-url': {
				alias: 'r',
				describe: 'Optional URL of an existing Run for uploading results',
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

		argv.example(
			'$0 junit-upload ./test-results.xml',
			'Create a new test run and upload results (project code detected from test names)'
		)

		argv.example(
			'$0 junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml',
			'Upload results to existing run ID 23 of Project P1'
		)

		argv.epilogue(`Requirements:
    Test case names in the XML report should contain QA Sphere test case reference (PROJECT-SEQUENCE).
    This reference is used to match test cases in the XML report with test cases in QA Sphere.

    - ${chalk.bold('PROJECT')} is your QASphere project code
    - ${chalk.bold('SEQUENCE')} is at least three-digit test case sequence number

    For example,
    - ${chalk.bold('PRJ-312')}: Login with valid credentials
    - Login with valid credentials: ${chalk.bold('PRJ-312')}

    Required environment variables (in .qaspherecli or exported):
    - QAS_TOKEN: Your QASphere API token
    - QAS_URL: Your QASphere instance URL (e.g., http://tenant1.localhost:5173)`)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		loadEnvs()
		const handler = new JUnitResultUploader(args)
		await handler.handle()
	}
}
