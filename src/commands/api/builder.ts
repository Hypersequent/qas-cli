import type { Argv, CommandModule, Options } from 'yargs'
import { Parser } from 'yargs/helpers'
import { executeCommand } from './executor'
import { formatApiError, isCustomFieldOption } from './utils'
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
			// Same format as the [choices: ...] yargs prints
			describe: spec.helpChoices
				? `${spec.describe} [choices: ${spec.helpChoices.map((c) => JSON.stringify(c)).join(', ')}]`
				: spec.describe,
			choices: spec.choices,
			...spec.yargsOption,
		}
	}
	return options
}

interface YargsOptions {
	key: Record<string, unknown>
	alias: Record<string, string[]>
}

/**
 * Lets a command take --cf-<system name> options. Strict mode would reject them as unknown, so the
 * command turns it off and rejects other unknown arguments itself, with strict mode's message.
 */
function allowCustomFieldOptions(yargs: Argv, spec: ApiEndpointSpec): void {
	// Custom field values are text: "007" must not become 7. Number options still parse.
	yargs.strict(false).parserConfiguration({ 'parse-numbers': false })
	yargs.check((argv) => {
		// Missing from yargs' types; it lists every option the command takes, global ones included.
		const { key, alias } = (yargs as unknown as { getOptions(): YargsOptions }).getOptions()
		const custom = Object.keys(argv).filter(isCustomFieldOption)
		// yargs adds a camelCase copy of each option given. A camelCase spelling of a --cf-* option
		// (--cfAutomation) has no --cf-* original, so it is rejected rather than silently dropped.
		const known = new Set(['_', '$0'])
		for (const name of [...Object.keys(key), ...Object.values(alias).flat(), ...custom]) {
			known.add(name).add(Parser.camelCase(name))
		}
		const unknown = [
			...argv._.slice(spec.commandPath.length + 1).map(String),
			...Object.keys(argv).filter((name) => !known.has(name)),
		]
		if (unknown.length === 0) return true
		return `Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`
	})
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

			if (spec.customFieldFilters) {
				allowCustomFieldOptions(yargs, spec)
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
				formatApiError(e, !!args.verbose)
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
