import type { Argv, CommandModule } from 'yargs'
import { buildCommandsFromSpecs } from './builder'
import { allSpecs } from './manifests/index'

export const apiCommand: CommandModule = {
	command: 'api',
	describe: 'Access QA Sphere API directly',
	builder: (yargs: Argv) => {
		buildCommandsFromSpecs(yargs, allSpecs)
		yargs.demandCommand(1, '')
		return yargs
	},
	handler: () => {},
}
