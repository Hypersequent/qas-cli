import { run as runCommand } from '../commands/main'

export const run = async (args: string) => {
	return runCommand(args)
}
