import { Argv, CommandModule } from 'yargs'
import { apiHandler, printJson } from '../utils'
import help from './help'

interface AuditLogsListArgs {
	after?: string
	count?: number
}

const listCommand: CommandModule<object, AuditLogsListArgs> = {
	command: 'list',
	describe: help.list.command,
	builder: (yargs: Argv) =>
		yargs
			.options({
				after: {
					type: 'string',
					describe: help.list.after,
				},
				count: {
					type: 'number',
					describe: help.list.count,
				},
			})
			.epilog(help.list.epilog),
	handler: apiHandler<AuditLogsListArgs>(async ({ after, count }, connectApi) => {
		const api = connectApi()
		const result = await api.auditLogs.listAuditLogs({ after, count })
		printJson(result)
	}),
}

export const auditLogsCommand: CommandModule = {
	command: 'audit-logs',
	describe: 'View audit logs',
	builder: (yargs: Argv) => yargs.command(listCommand).demandCommand(1, ''),
	handler: () => {},
}
