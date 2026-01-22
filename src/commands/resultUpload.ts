import { Arguments, Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { loadEnvs, qasEnvFile } from '../utils/env'
import {
	ResultUploadCommandArgs,
	ResultUploadCommandHandler,
	UploadCommandType,
} from '../utils/result-upload/ResultUploadCommandHandler'

const commandTypeDisplayStrings: Record<UploadCommandType, string> = {
	'junit-upload': 'JUnit XML',
	'playwright-json-upload': 'Playwright JSON',
	'xcresult-upload': 'Xcode Result Bundle',
}

const commandTypeFileExtensions: Record<UploadCommandType, string> = {
	'junit-upload': 'xml',
	'playwright-json-upload': 'json',
	'xcresult-upload': 'xcresult',
}

export class ResultUploadCommandModule implements CommandModule<unknown, ResultUploadCommandArgs> {
	constructor(private readonly type: UploadCommandType) {}

	get command() {
		return `${this.type} [args..] <files..>`
	}

	get describe() {
		return `Upload ${commandTypeDisplayStrings[this.type]}s to a new or existing test run`
	}

	builder = (argv: Argv) => {
		argv.options({
			'run-url': {
				alias: 'r',
				describe: 'Optional URL of an existing test run for uploading results',
				type: 'string',
				requiresArg: true,
			},
			'project-code': {
				describe:
					'Existing project code for uploading results (when run url is not specified). It can also be auto detected from test case markers in the results, but this is not fully reliable, so it is recommended to specify the project code explicitly',
				type: 'string',
			},
			'run-name': {
				describe:
					'Optional name template for creating new test run (when run url is not specified). If not specified, "Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}" is used as default',
				type: 'string',
			},
			'create-tcases': {
				describe:
					'Create new test cases for results without valid markers (when run url is not specified). This also creates a mapping file ("qasphere-automapping-YYYYMMDD-HHmmss.txt") showing the markers corresponding to each new test case, use it to update your test cases to include the markers in the name, for future uploads',
				type: 'boolean',
				default: false,
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
			'skip-report-stdout': {
				describe: 'When to skip stdout from test results',
				type: 'string',
				choices: ['on-success', 'never'] as const,
				default: 'never' as const,
			},
			'skip-report-stderr': {
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
			`$0 ${this.type} -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.${
				commandTypeFileExtensions[this.type]
			}`,
			'Upload results to existing run ID 23 of project P1'
		)

		argv.example(
			`$0 ${this.type} ./test-results.${commandTypeFileExtensions[this.type]}`,
			'Create a new test run with default name template and upload results. Project code is detected from test case markers in the results'
		)

		argv.example(
			`$0 ${this.type} --project-code P1 --run-name "v1.4.4-rc5" ./test-results.${
				commandTypeFileExtensions[this.type]
			}`,
			'Create a new test run with name template without any placeholders and upload results'
		)

		argv.example(
			`$0 ${
				this.type
			} --project-code P1 --run-name "CI Build {env:BUILD_NUMBER} - {YYYY}-{MM}-{DD}" ./test-results.${
				commandTypeFileExtensions[this.type]
			}`,
			'Create a new test run with name template using environment variable and date placeholders and upload results'
		)

		argv.example(
			`$0 ${
				this.type
			} --project-code P1 --run-name "Nightly Tests {YYYY}/{MM}/{DD} {HH}:{mm}" --create-tcases ./test-results.${
				commandTypeFileExtensions[this.type]
			}`,
			'Create a new test run with name template using date and time placeholders and create test cases for results without valid markers and upload results'
		)

		argv.epilogue(`
${chalk.bold('Modes:')}
  There are two modes for uploading results using the command:
    - Upload to an existing test run by specifying its URL via ${chalk.bold(
			'--run-url'
		)} flag. Project code and the run ID are extracted from the URL
    - Create a new test run and upload results to it (when --run-url flag is not specified). Following flags (all optional) are applicable in this mode: ${chalk.bold(
			'--project-code'
		)}, ${chalk.bold('--run-name')}, ${chalk.bold('--create-tcases')}
  All other options are applicable to both the modes.

${chalk.bold('Test Case Matching:')}
  Test case names in the report should contain QA Sphere test case markers (PROJECT-SEQUENCE) to match the results.
    - ${chalk.bold('PROJECT')} is your QASphere project code
    - ${chalk.bold('SEQUENCE')} is at least three-digit test case sequence number

  For example,
    - ${chalk.bold('PRJ-312')}: Login with valid credentials
    - Login with valid credentials: ${chalk.bold('PRJ-312')}

  If markers are not present, use ${chalk.bold(
		'--create-tcases'
	)} to automatically create test cases in QA Sphere.

${chalk.bold('Required environment variables:')}
  These should be either defined in a ${qasEnvFile} file or exported as environment variables:
    - ${chalk.bold('QAS_TOKEN')}: Your QASphere API token
    - ${chalk.bold('QAS_URL')}: Your QASphere instance URL (e.g., https://qas.eu1.qasphere.com)

${chalk.bold('Run name template placeholders:')}
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
