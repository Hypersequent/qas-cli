import { Arguments, Argv, CommandModule } from 'yargs'

import { executeApiCommand } from './executor'
import { apiEndpointSpecs } from './manifest'
import { ApiEndpointSpec } from './types'

type ApiCommandArgs = Record<string, unknown> & {
	body?: string
	bodyFile?: string
	bodyStdin?: boolean
	file?: string
	cf?: string[]
}

interface ApiCommandTreeNode {
	segment?: string
	spec?: ApiEndpointSpec
	children: Map<string, ApiCommandTreeNode>
}

const buildCommandTree = (specs: ApiEndpointSpec[]) => {
	const root: ApiCommandTreeNode = {
		segment: 'api',
		children: new Map(),
	}

	for (const spec of specs) {
		let current = root
		for (const segment of spec.commandPath) {
			let next = current.children.get(segment)
			if (!next) {
				next = {
					segment,
					children: new Map(),
				}
				current.children.set(segment, next)
			}
			current = next
		}
		current.spec = spec
	}

	return root
}

class ApiEndpointCommandModule implements CommandModule<unknown, ApiCommandArgs> {
	constructor(
		private readonly segment: string,
		private readonly spec: ApiEndpointSpec
	) {}

	get command() {
		const pathParams = this.spec.pathParams.map((param) => `<${param.name}>`).join(' ')
		return [this.segment, pathParams].filter(Boolean).join(' ')
	}

	get describe() {
		return this.spec.describe
	}

	builder = (argv: Argv) => {
		for (const param of this.spec.pathParams) {
			argv.positional(param.name, {
				describe: param.describe,
				type: param.type === 'integer' ? 'number' : 'string',
			})
		}

		for (const queryOption of this.spec.queryOptions ?? []) {
			argv.option(queryOption.name, {
				describe: queryOption.describe,
				type: queryOption.type === 'integer' ? 'number' : queryOption.type,
				array: queryOption.array,
				choices: queryOption.choices,
			})
		}

		if (this.spec.supportsCustomFieldFilters) {
			argv.option('cf', {
				describe: 'Custom field filter in systemName=value format. Repeat to add more values.',
				type: 'string',
				array: true,
			})
		}

		if (this.spec.bodyMode === 'json') {
			argv
				.option('body', {
					describe: 'Inline JSON request body',
					type: 'string',
				})
				.option('body-file', {
					describe: 'Load JSON request body from a file',
					type: 'string',
				})
				.option('body-stdin', {
					describe: 'Load JSON request body from stdin',
					type: 'boolean',
					default: false,
				})
		}

		if (this.spec.bodyMode === 'file') {
			argv.option('file', {
				describe: 'Path to the file to upload',
				type: 'string',
			})
		}

		return argv
	}

	handler = async (args: Arguments<ApiCommandArgs>) => {
		const response = await executeApiCommand(this.spec, args)
		process.stdout.write(`${JSON.stringify(response ?? null, null, 2)}\n`)
	}
}

class ApiCommandNodeModule implements CommandModule {
	constructor(
		private readonly node: ApiCommandTreeNode,
		private readonly isRoot = false
	) {}

	get command() {
		return this.node.segment ?? 'api'
	}

	get describe() {
		return this.isRoot
			? 'Call QA Sphere public API endpoints'
			: `QA Sphere ${this.command} commands`
	}

	builder = (argv: Argv) => {
		for (const child of this.node.children.values()) {
			if (child.spec && child.children.size === 0) {
				argv.command(new ApiEndpointCommandModule(child.segment!, child.spec))
				continue
			}
			argv.command(new ApiCommandNodeModule(child))
		}

		if (this.isRoot) {
			argv.epilogue(
				[
					'JSON body input:',
					'  Use exactly one of --body, --body-file, or --body-stdin for commands that require JSON.',
					'Custom field filters:',
					'  Repeat --cf systemName=value to add dynamic custom-field query filters.',
				].join('\n')
			)
		}

		return argv.demandCommand(1)
	}

	handler = async () => {}
}

const apiCommandTree = buildCommandTree(apiEndpointSpecs)

export class ApiCommandModule extends ApiCommandNodeModule {
	constructor() {
		super(apiCommandTree, true)
	}
}
