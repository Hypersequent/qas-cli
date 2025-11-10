import { Arguments, Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { loadEnvs } from '../utils/env'
import {
	ResultUploadCommandArgs,
	ResultUploadCommandHandler,
	UploadCommandType
} from '../utils/result-upload/ResultUploadCommandHandler'

const commandTypeDisplayStrings: Record<UploadCommandType, string> = {
	'junit-upload': 'JUnit XML',
	'playwright-json-upload': 'Playwright JSON',
}

const commandTypeFileExtensions: Record<UploadCommandType, string> = {
	'junit-upload': 'xml',
	'playwright-json-upload': 'json',
}

export class ResultUploadCommandModule implements CommandModule<unknown, ResultUploadCommandArgs> {
	constructor(private readonly type: UploadCommandType) {}

	get command() {
		return `${this.type} [args..] <files..>`
	}

	get describe() {
		return `Upload ${commandTypeDisplayStrings[this.type]} files to a new or existing test run`
	}

	builder = (argv: Argv) => {
		argv.options({
			'run-url': {
				alias: 'r',
				describe: 'Optional URL of an existing test run for uploading results',
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
			'ignore-unmatched': {
				describe: 'Suppress individual unmatched test messages, show summary only',
				type: 'boolean',
			},
			'skip-stdout': {
				describe: 'When to skip stdout from test results',
				type: 'string',
				choices: ['on-success', 'never'] as const,
				default: 'never' as const,
			},
			'skip-stderr': {
				describe: 'When to skip stderr from test results',
				type: 'string',
				choices: ['on-success', 'never'] as const,
				default: 'never' as const,
			},
			help: {
				alias: 'h',
				help: true,
			},
		})

		argv.example(
			`$0 ${this.type} ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Create a new test run with default name template and upload results (project code detected from test names)'
		)

		argv.example(
			`$0 ${this.type} -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Upload results to existing run ID 23 of project P1'
		)

		argv.example(
			`$0 ${this.type} --run-name "v1.4.4-rc5" ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Create a new test run with name template without any placeholders and upload results'
		)

		argv.example(
			`$0 ${this.type} --run-name "CI Build {env:BUILD_NUMBER} - {YYYY}-{MM}-{DD}" ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Create a new test run with name template using environment variable and date placeholders and upload results'
		)

		argv.example(
			`$0 ${this.type} --run-name "Nightly Tests {YYYY}/{MM}/{DD} {HH}:{mm}" ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Create a new test run with name template using date and time placeholders and upload results'
		)

		argv.epilogue(`Requirements:
  Test case names in the report should contain QA Sphere test case reference (PROJECT-SEQUENCE). This reference is used to match test cases in the report with test cases in QA Sphere.
    - ${chalk.bold('PROJECT')} is your QASphere project code
    - ${chalk.bold('SEQUENCE')} is at least three-digit test case sequence number

  For example,
    - ${chalk.bold('PRJ-312')}: Login with valid credentials
    - Login with valid credentials: ${chalk.bold('PRJ-312')}

  Required environment variables (in .qaspherecli or exported):
    - QAS_TOKEN: Your QASphere API token
    - QAS_URL: Your QASphere instance URL (e.g., https://qas.eu1.qasphere.com)

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

		return argv as Argv<ResultUploadCommandArgs>
	}

	handler = async (args: Arguments<ResultUploadCommandArgs>) => {
		loadEnvs()
		const handler = new ResultUploadCommandHandler(this.type, args)
		await handler.handle()
	}
}
