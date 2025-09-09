import { Arguments, Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { JUnitResultUploader } from '../utils/junit/JUnitResultUploader'
import { loadEnvs } from '../utils/env'

export interface JUnitArgs {
	runUrl?: string
	runName?: string
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
			'run-name': {
				describe:
					'Optional name template for creating new test run when run url is not specified. If not specified, "Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}" is used as default',
				type: 'string',
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
			'Create a new test run with default name template and upload results (project code detected from test names)'
		)

		argv.example(
			'$0 junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml',
			'Upload results to existing run ID 23 of Project P1'
		)

		argv.example(
			'$0 junit-upload --run-name "v1.4.4-rc5" ./test-results.xml',
			'Create a new test run with name template without any placeholders and upload results'
		)

		argv.example(
			'$0 junit-upload --run-name "CI Build {env:BUILD_NUMBER} - {YYYY}-{MM}-{DD}" ./test-results.xml',
			'Create a new test run with name template using environment variable and date placeholders and upload results'
		)

		argv.example(
			'$0 junit-upload --run-name "Nightly Tests {YYYY}/{MM}/{DD} {HH}:{mm}" ./test-results.xml',
			'Create a new test run with name template using date and time placeholders and upload results'
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
    - QAS_URL: Your QASphere instance URL (e.g., http://tenant1.localhost:5173)

Run name template placeholders:
    - ${chalk.bold('{env:VAR_NAME}')}: Environment variables
    - ${chalk.bold('{YYYY}')}: 4-digit year
    - ${chalk.bold('{YY}')}: 2-digit year
    - ${chalk.bold('{MMM}')}: 3-letter month (e.g., Jan, Feb, Mar)
    - ${chalk.bold('{MM}')}: 2-digit month
    - ${chalk.bold('{DD}')}: 2-digit day
    - ${chalk.bold('{HH}')}: 2-digit hour (24-hour format)
    - ${chalk.bold('{hh}')}: 2-digit hour (12-hour format)
    - ${chalk.bold('{mm}')}: 2-digit minute
    - ${chalk.bold('{ss}')}: 2-digit second
    - ${chalk.bold('{AMPM}')}: AM/PM`)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		loadEnvs()
		const handler = new JUnitResultUploader(args)
		await handler.handle()
	}
}
