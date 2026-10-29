import type { Argv, CommandModule } from 'yargs'
import chalk from 'chalk'
import { statSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { confirm, isInteractive } from '../utils/prompt'
import {
	detectAgents,
	getAgents,
	getSkillStatus,
	installSkill,
	isOutdated,
	readSkillVersion,
	refreshSkill,
	sharedSkillDir,
	skillDirFor,
	uninstallSkill,
	type Agent,
	type InstallResult,
} from '../utils/skill'
import { CLI_VERSION } from '../utils/version'

const SKILL_LABEL = 'QA Sphere agent skill'
const OTHER_AGENTS_DOCS_URL = 'https://qasphere.com/docs/cli/agent-skill/#other-agents'

const tildify = (path: string): string => {
	const home = homedir()
	return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path
}

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e))

const agentsById = (ids: string[]): Agent[] => getAgents().filter((agent) => ids.includes(agent.id))

const withAgentOption = (yargs: Argv) =>
	yargs.option('agent', {
		alias: 'a',
		type: 'string',
		array: true,
		choices: getAgents().map((agent) => agent.id),
		describe: 'Agent to target; repeat for several',
	})

function printInstalled(results: InstallResult[]): void {
	const shared = sharedSkillDir()
	console.log(`Installed the ${SKILL_LABEL} v${CLI_VERSION}:`)
	if (results.length === 0) {
		console.log(`  ${chalk.green('✓')} ${tildify(shared)}`)
	}
	for (const { agent, dir, linkedTo } of results) {
		const target = linkedTo ? ` -> ${tildify(linkedTo)}` : ''
		console.log(`  ${chalk.green('✓')} ${agent.name}: ${tildify(dir)}${target}`)
	}

	const readers = getAgents()
		.filter((agent) => skillDirFor(agent) === shared)
		.map((agent) => agent.name)
	const too = results.length > 0 ? ' too' : ''
	console.log(
		`${readers.join(', ')} and other agents that read ${tildify(dirname(shared))} load it from there${too}.`
	)
	if (results.length === 0) {
		console.log(`For other agents, see ${OTHER_AGENTS_DOCS_URL}`)
	}
	console.log('Start a new agent session to load it.')
}

function handleInstall(ids: string[] | undefined): void {
	const agents = ids?.length ? agentsById(ids) : detectAgents()
	if (agents.length === 0) {
		console.log('No supported coding agents found.')
	}

	try {
		printInstalled(installSkill(agents))
	} catch (e) {
		console.error(chalk.red('Error:') + ` Could not install the ${SKILL_LABEL}: ${errorMessage(e)}`)
		process.exit(1)
	}
}

function handleStatus(): void {
	const shared = sharedSkillDir()
	// The shared copy alone would list every undetected agent that reads ~/.agents/skills
	const statuses = getSkillStatus()
		.filter((status) => status.detected || (status.version && status.dir !== shared))
		.map(({ agent, dir, version }) => ({ name: agent.name, dir, version }))
	// Listed on its own when no detected agent reads it, e.g. after an install that found no agents
	const sharedVersion = readSkillVersion(shared)
	if (sharedVersion && !statuses.some((status) => status.dir === shared)) {
		statuses.push({ name: 'Shared copy', dir: shared, version: sharedVersion })
	}
	if (statuses.length === 0) {
		console.log('No supported coding agents found.')
		return
	}

	console.log(`CLI version: ${CLI_VERSION}`)
	const rows = statuses.map(({ name, dir, version }) => {
		const ok = version !== null && !isOutdated(version)
		const state = !version ? 'not installed' : ok ? `v${version}` : `v${version} (outdated)`
		return { name, state, ok, dir: tildify(dir) }
	})
	const nameWidth = Math.max(...rows.map((row) => row.name.length))
	const stateWidth = Math.max(...rows.map((row) => row.state.length))
	for (const { name, state, ok, dir } of rows) {
		const colored = (ok ? chalk.green : chalk.yellow)(state.padEnd(stateWidth))
		console.log(`  ${name.padEnd(nameWidth)}  ${colored}  ${dir}`)
	}

	if (rows.some((row) => !row.ok)) {
		console.log('Run "qasphere skill install" to install or update it.')
	}
}

function handleUninstall(): void {
	let removed: string[]
	try {
		removed = uninstallSkill()
	} catch (e) {
		console.error(chalk.red('Error:') + ` Could not remove the ${SKILL_LABEL}: ${errorMessage(e)}`)
		process.exit(1)
	}

	if (removed.length === 0) {
		console.log(`The ${SKILL_LABEL} is not installed.`)
		return
	}
	for (const dir of removed) {
		console.log(`Removed ${tildify(dir)}`)
	}
}

/** Offers the skill to detected agents that lack it or have an older version. */
export async function offerSkillInstall(): Promise<void> {
	if (!isInteractive()) return

	const pending = getSkillStatus(detectAgents()).filter(
		(status) => !status.version || isOutdated(status.version)
	)
	if (pending.length === 0) return

	const names = pending.map((status) => status.agent.name).join(', ')
	const action = pending.some((status) => status.version) ? 'Install or update' : 'Install'
	console.log()
	if (!(await confirm(`${action} the ${SKILL_LABEL} for ${names}? [Y/n] `))) {
		console.log('Skipped. Run "qasphere skill install" to install it later.')
		return
	}

	try {
		printInstalled(installSkill(pending.map((status) => status.agent)))
	} catch (e) {
		console.error(
			chalk.yellow('Warning:') +
				` Could not install the ${SKILL_LABEL}: ${errorMessage(e)}. Run "qasphere skill install" to retry.`
		)
	}
}

const WARNING_INTERVAL_MS = 24 * 60 * 60 * 1000

// A failed update fails again on every run, e.g. inside an agent's sandbox. The marker sits in the
// temp directory because sandboxes that block writes to the home directory usually allow it.
function shouldWarnAboutFailedUpdate(): boolean {
	const marker = join(tmpdir(), `qasphere-skill-warning-${process.getuid?.() ?? 0}-${CLI_VERSION}`)
	try {
		if (Date.now() - statSync(marker).mtimeMs < WARNING_INTERVAL_MS) return false
	} catch {
		// No warning yet
	}
	try {
		writeFileSync(marker, '')
	} catch {
		// Warn every time rather than never
	}
	return true
}

/** Keeps installed copies at the CLI's version; runs before every command but `skill`. */
export function refreshAgentSkill(): void {
	try {
		if (refreshSkill().length > 0) {
			console.error(chalk.yellow(`Updated the ${SKILL_LABEL} to v${CLI_VERSION}.`))
		}
	} catch (e) {
		if (shouldWarnAboutFailedUpdate()) {
			console.error(
				chalk.yellow('Warning:') +
					` Could not update the ${SKILL_LABEL}: ${errorMessage(e)}. Run "qasphere skill install" to update it.`
			)
		}
	}
}

export const skillCommand: CommandModule = {
	command: 'skill',
	describe: 'Manage the QA Sphere skill for AI coding agents',
	builder: (yargs: Argv) =>
		yargs
			.command({
				command: 'install',
				describe: 'Install or update the skill for detected agents, or those given with --agent',
				builder: withAgentOption,
				handler: (args) => handleInstall(args.agent),
			})
			.command({
				command: 'status',
				describe: 'Show the installed skill version for each agent',
				handler: () => handleStatus(),
			})
			.command({
				command: 'uninstall',
				describe: 'Remove the skill from every agent',
				handler: () => handleUninstall(),
			})
			.demandCommand(1, ''),
	handler: () => {},
}
