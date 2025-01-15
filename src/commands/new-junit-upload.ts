import { Arguments, Argv, CommandModule } from 'yargs'
import { JUnitArgs } from './junit-upload'
import { NewJUnitCommandHandler } from '../utils/junit/NewJUnitCommandHandler'

export class NewJUnitTestRunCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'new-junit-testrun <files..>'
	describe = 'Create a new test run from JUnit XML files and upload results'

	builder = (argv: Argv): Argv<JUnitArgs> => {
		return argv
			.positional('files', {
				describe: 'JUnit XML files to process',
				type: 'string',
				array: true,
				demandOption: true,
			})
			.option('project', {
				alias: 'p',
				describe: 'Full URL to the project (e.g., https://qas.eu1.qasphere.com/project/P1)',
				type: 'string',
			})
			.option('run-url', {
				alias: 'r',
				describe: 'Full URL to the run (e.g., https://qas.eu1.qasphere.com/project/P1/run/7)',
				type: 'string',
			})
			.option('attachments', {
				describe: 'Try to detect any attachments and upload it with the test result',
				type: 'boolean',
			})
			.option('force', {
				describe: 'Ignore API request errors, invalid test cases or attachments',
				type: 'boolean',
				default: false,
			})
			.check((argv) => {
				if (!argv.project && !argv['run-url']) {
					throw new Error('You must provide either --project or --run-url.')
				}
				if (argv.project && argv['run-url']) {
					throw new Error('You cannot provide both --project and --run-url.')
				}
				return true
			})
			.example(
				'$0 new-junit-testrun -p https://qas.eu1.qasphere.com/project/P1 ./test-results.xml',
				'Create a new test run for the P1 project and upload results'
			)
			.example(
				'$0 new-junit-testrun -r https://qas.eu1.qasphere.com/project/P1/run/7 file1.xml file2.xml',
				'Upload test results to test run 7 within the P1 project'
			) as unknown as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		const handler = new NewJUnitCommandHandler(args)
		await handler.handle()
	}
}
