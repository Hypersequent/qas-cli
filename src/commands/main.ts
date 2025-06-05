import yargs from 'yargs'
import { JUnitUploadCommandModule } from './junit-upload'
import { qasEnvs, qasEnvFile } from '../utils/env'

export const run = (args: string | string[]) =>
	yargs(args)
		.usage(
			`$0 <command> [options]

Required variables: ${qasEnvs.join(', ')}
  These should be either exported as environment variables or defined in a ${qasEnvFile} file in the current directory or one of its parents.`
		)
		.command(new JUnitUploadCommandModule())
		.demandCommand(1, "")
		.help('h')
		.alias('h', 'help')
		.version()
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
				yi.showHelp();
				process.exit(0);
			} else {
				if (msg) {
					console.error(msg);
					if (msg.startsWith('Unknown argument') || msg.startsWith('Not enough non-option arguments')) {
						yi.showHelp();
						process.exit(0);
					}
				} else if (err && err.message) {
					console.error(err.message);
				} else if (err) {
					console.error(String(err));
				} else {
					console.error('An unexpected error occurred.');
				}
				process.exit(1);
			}
		})
		.parse()
