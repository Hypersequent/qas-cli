import { Argv, CommandModule } from 'yargs'
import { validateProjectCode } from './utils'
import { auditLogsCommand } from './audit-logs/command'
import { customFieldsCommand } from './custom-fields/command'
import { filesCommand } from './files/command'
import { foldersCommand } from './folders/command'
import { milestonesCommand } from './milestones/command'
import { projectsCommand } from './projects/command'
import { requirementsCommand } from './requirements/command'
import { resultsCommand } from './results/command'
import { runsCommand } from './runs/command'
import { settingsCommand } from './settings/command'
import { sharedPreconditionsCommand } from './shared-preconditions/command'
import { sharedStepsCommand } from './shared-steps/command'
import { tagsCommand } from './tags/command'
import { testCasesCommand } from './test-cases/command'
import { testPlansCommand } from './test-plans/command'
import { usersCommand } from './users/command'

export const apiCommand: CommandModule = {
	command: 'api',
	describe: 'Access QA Sphere API directly',
	builder: (yargs: Argv) =>
		yargs
			.command(auditLogsCommand)
			.command(customFieldsCommand)
			.command(filesCommand)
			.command(foldersCommand)
			.command(milestonesCommand)
			.command(projectsCommand)
			.command(requirementsCommand)
			.command(resultsCommand)
			.command(runsCommand)
			.command(settingsCommand)
			.command(sharedPreconditionsCommand)
			.command(sharedStepsCommand)
			.command(tagsCommand)
			.command(testCasesCommand)
			.command(testPlansCommand)
			.command(usersCommand)
			.demandCommand(1, '')
			.check((argv) => {
				const projectCode = argv['project-code'] as string | undefined
				if (projectCode) {
					validateProjectCode([projectCode, '--project-code'])
				}
				return true
			}),
	handler: () => {},
}
