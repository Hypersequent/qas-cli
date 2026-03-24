import { Argv, CommandModule } from 'yargs'
import { apiHandler, parseAndValidateJsonArg, printJson, validatePathParams } from '../utils'
import { createProjectBodySchema, projectLinksSchema } from './schemas'
import help from './help'

const listCommand: CommandModule = {
	command: 'list',
	describe: help.list.command,
	builder: (yargs: Argv) => yargs.epilog(help.list.epilog),
	handler: apiHandler(async (_args, connectApi) => {
		const api = connectApi()
		const result = await api.projects.listProjects()
		printJson(result)
	}),
}

interface ProjectsGetArgs {
	'project-code': string
}

const getCommand: CommandModule<object, ProjectsGetArgs> = {
	command: 'get',
	describe: help.get.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				'project-code': {
					type: 'string',
					demandOption: true,
					describe: help['project-code'],
				},
			})
			.epilog(help.get.epilog),
	handler: apiHandler<ProjectsGetArgs>(async (args, connectApi) => {
		const api = connectApi()
		const result = await api.projects.getProject(args['project-code'])
		printJson(result)
	}),
}

interface ProjectsCreateArgs {
	code: string
	title: string
	links?: string
	'overview-title'?: string
	'overview-description'?: string
}

const createCommand: CommandModule<object, ProjectsCreateArgs> = {
	command: 'create',
	describe: help.create.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				code: {
					type: 'string',
					demandOption: true,
					describe: help.create.code,
				},
				title: {
					type: 'string',
					demandOption: true,
					describe: help.create.title,
				},
				links: {
					type: 'string',
					describe: help.create.links,
				},
				'overview-title': {
					type: 'string',
					describe: help.create['overview-title'],
				},
				'overview-description': {
					type: 'string',
					describe: help.create['overview-description'],
				},
			})
			.example(help.examples[0].usage, help.examples[0].description)
			.epilog(help.create.epilog)
			.check((argv) => {
				validatePathParams([argv.code, '--code'])
				return true
			}),
	handler: apiHandler<ProjectsCreateArgs>(async (args, connectApi) => {
		const {
			'overview-title': overviewTitle,
			'overview-description': overviewDescription,
			links: linksArg,
			...restArgs
		} = args
		const links = linksArg
			? parseAndValidateJsonArg(linksArg, '--links', projectLinksSchema)
			: undefined

		const validated = createProjectBodySchema.parse({
			...restArgs,
			overviewTitle,
			overviewDescription,
			links,
		})
		const api = connectApi()
		const result = await api.projects.createProject(validated)
		printJson(result)
	}),
}

export const projectsCommand: CommandModule = {
	command: 'projects',
	describe: 'Manage projects',
	builder: (yargs: Argv) =>
		yargs.command(listCommand).command(getCommand).command(createCommand).demandCommand(1, ''),
	handler: () => {},
}
