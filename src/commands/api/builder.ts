import type { Argv, CommandModule, Options } from 'yargs'
import { executeCommand } from './executor'
import { formatApiError } from './utils'
import type { ApiEndpointSpec, ApiFieldSpec, ApiPathParamSpec, ApiQueryOptionSpec } from './types'

interface CommandNode {
	segment: string
	spec?: ApiEndpointSpec
	children: Map<string, CommandNode>
}

/**
 * Builds a tree of command nodes from a flat array of endpoint specs.
 * Handles nesting like ['runs', 'tcases', 'list'] automatically.
 */
function buildCommandTree(specs: ApiEndpointSpec[]): CommandNode {
	const root: CommandNode = { segment: 'api', children: new Map() }

	for (const spec of specs) {
		let current = root
		for (const segment of spec.commandPath) {
			if (!current.children.has(segment)) {
				current.children.set(segment, {
					segment,
					children: new Map(),
				})
			}
			current = current.children.get(segment)!
		}
		current.spec = spec
	}

	return root
}

function buildPathParamOptions(pathParams: ApiPathParamSpec[]): Record<string, Options> {
	const options: Record<string, Options> = {}
	for (const param of pathParams) {
		options[param.name] = {
			type: param.type,
			demandOption: true,
			describe: param.describe,
		}
	}
	return options
}

function buildOptions(specs: (ApiQueryOptionSpec | ApiFieldSpec)[]): Record<string, Options> {
	const options: Record<string, Options> = {}
	for (const spec of specs) {
		options[spec.name] = {
			type: spec.type,
			describe: spec.describe,
			choices: spec.choices,
			...spec.yargsOption,
		}
	}
	return options
}

/**
 * Creates a yargs CommandModule for a leaf node (actual endpoint).
 */
function createEndpointCommand(spec: ApiEndpointSpec): CommandModule {
	return {
		command: spec.commandPath[spec.commandPath.length - 1],
		describe: spec.describe,
		builder: (yargs: Argv) => {
			if (spec.pathParams.length > 0) {
				yargs.options(buildPathParamOptions(spec.pathParams))
			}

			if (spec.queryOptions && spec.queryOptions.length > 0) {
				yargs.options(buildOptions(spec.queryOptions))
			}

			if (spec.bodyMode === 'json') {
				yargs.options({
					body: { type: 'string', describe: 'Request body as inline JSON' },
					'body-file': {
						type: 'string',
						describe: 'Path to a JSON file to use as request body',
					},
				})
				yargs.conflicts('body', 'body-file')

				// Individual field options
				if (spec.fieldOptions && spec.fieldOptions.length > 0) {
					yargs.options(buildOptions(spec.fieldOptions))
				}
			} else if (spec.bodyMode === 'file') {
				yargs.options({
					file: {
						type: 'string',
						demandOption: true,
						describe: 'Path to file to upload',
					},
				})
			}

			if (spec.check) {
				yargs.check((argv) => spec.check!(argv as Record<string, unknown>))
			}

			if (spec.examples) {
				for (const example of spec.examples) {
					yargs.example(example.usage, example.description)
				}
			}

			if (spec.epilog) {
				yargs.epilog(spec.epilog)
			}

			return yargs
		},
		handler: async (args) => {
			try {
				await executeCommand(spec, args as Record<string, unknown>)
			} catch (e) {
				formatApiError(e)
				process.exit(1)
			}
		},
	}
}

/**
 * Creates a yargs CommandModule for an intermediate node (command group).
 */
function createGroupCommand(node: CommandNode): CommandModule {
	const childCommands = buildChildCommands(node)

	return {
		command: node.segment,
		describe: node.spec?.describe ?? `Manage ${node.segment}`,
		builder: (yargs: Argv) => {
			for (const cmd of childCommands) {
				yargs.command(cmd)
			}
			yargs.demandCommand(1, '')
			return yargs
		},
		handler: () => {},
	}
}

function buildChildCommands(node: CommandNode): CommandModule[] {
	const commands: CommandModule[] = []

	for (const child of node.children.values()) {
		if (child.children.size > 0) {
			// Intermediate node — recurse
			commands.push(createGroupCommand(child))
		} else if (child.spec) {
			// Leaf node — endpoint
			commands.push(createEndpointCommand(child.spec))
		}
	}

	return commands
}

/**
 * Registers manifest-based commands onto a yargs instance.
 * Builds a command tree from flat specs and registers top-level resource commands.
 */
export function buildCommandsFromSpecs(yargs: Argv, specs: ApiEndpointSpec[]): void {
	const root = buildCommandTree(specs)

	for (const child of root.children.values()) {
		if (child.children.size > 0) {
			yargs.command(createGroupCommand(child))
		} else if (child.spec) {
			yargs.command(createEndpointCommand(child.spec))
		}
	}
}
