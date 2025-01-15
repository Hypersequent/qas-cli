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
            .option('run-url', {
                alias: 'r',
                describe: 'Full URL to the project or run (e.g., https://qas.eu1.qasphere.com/project/P1/run/7)',
                type: 'string',
                demandOption: true,
                requiresArg: true,
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
            .example(
                '$0 new-junit-testrun --run-url https://qas.eu1.qasphere.com/project/P1 ./test-results.xml',
                'Create new test run for P1 project from test-results.xml and upload results'
            )
            .example(
                '$0 new-junit-testrun -r https://qas.eu1.qasphere.com/project/P1/run/7 file1.xml file2.xml --force',
                'Upload test results to test run 7 within P1 project from multiple files in force mode'
            ) as unknown as Argv<JUnitArgs>
    }

    handler = async (args: Arguments<JUnitArgs>) => {
        const handler = new NewJUnitCommandHandler(args)
        await handler.handle()
    }
}