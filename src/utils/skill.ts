import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { lt, valid } from 'semver'
import { CLI_VERSION, PACKAGE_ROOT } from './version'

export const SKILL_NAME = 'qas-cli'

export interface Agent {
	id: string
	name: string
	/** Any of these existing means the agent is installed */
	configDirs: string[]
	/** User-level directory the agent loads skills from */
	skillsDir: string
}

export interface InstallResult {
	agent: Agent
	dir: string
	/** Set when `dir` is a symlink to the shared copy */
	linkedTo?: string
}

export interface SkillStatus {
	agent: Agent
	dir: string
	detected: boolean
	version: string | null
}

const sharedSkillsDir = (): string => join(homedir(), '.agents', 'skills')

// Mirrors the global paths of vercel-labs/skills (src/agents.ts), so installs made here and with
// `npx skills add -g` share one layout and replace each other cleanly.
export function getAgents(): Agent[] {
	const home = homedir()
	const configHome = process.env.XDG_CONFIG_HOME?.trim() || join(home, '.config')
	const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude')
	const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex')
	const vibeHome = process.env.VIBE_HOME?.trim() || join(home, '.vibe')
	const shared = sharedSkillsDir()
	const agent = (
		id: string,
		name: string,
		configDir: string,
		skillsDir = join(configDir, 'skills')
	): Agent => ({ id, name, configDirs: [configDir], skillsDir })

	return [
		agent('claude-code', 'Claude Code', claudeHome),
		agent('codex', 'Codex', codexHome, shared),
		agent('cursor', 'Cursor', join(home, '.cursor')),
		agent('gemini-cli', 'Gemini CLI', join(home, '.gemini')),
		agent('antigravity', 'Antigravity', join(home, '.gemini', 'antigravity')),
		agent('github-copilot', 'GitHub Copilot', join(home, '.copilot')),
		agent('opencode', 'OpenCode', join(configHome, 'opencode')),
		agent('windsurf', 'Windsurf', join(home, '.codeium', 'windsurf')),
		agent('amp', 'Amp', join(configHome, 'amp'), join(configHome, 'agents', 'skills')),
		agent('cline', 'Cline', join(home, '.cline'), shared),
		agent('zed', 'Zed', join(configHome, 'zed'), shared),
		agent('warp', 'Warp', join(home, '.warp'), shared),
		agent('droid', 'Droid', join(home, '.factory')),
		{
			...agent('kilo', 'Kilo Code', join(home, '.kilo')),
			// ~/.kilocode is Kilo Code's legacy config directory
			configDirs: [join(home, '.kilo'), join(home, '.kilocode')],
		},
		agent('continue', 'Continue', join(home, '.continue')),
		agent('openhands', 'OpenHands', join(home, '.openhands')),
		// Crush ignores XDG_CONFIG_HOME
		agent('crush', 'Crush', join(home, '.config', 'crush')),
		agent('mistral-vibe', 'Mistral Vibe', vibeHome),
		agent('rovodev', 'Rovo Dev', join(home, '.rovodev')),
		agent('devin', 'Devin for Terminal', join(configHome, 'devin')),
		agent('kiro-cli', 'Kiro CLI', join(home, '.kiro')),
		agent('roo', 'Roo Code', join(home, '.roo')),
		agent('goose', 'Goose', join(configHome, 'goose')),
		agent('junie', 'Junie', join(home, '.junie')),
		agent('qwen-code', 'Qwen Code', join(home, '.qwen')),
		agent('augment', 'Augment', join(home, '.augment')),
		agent('trae', 'Trae', join(home, '.trae')),
	]
}

const isDetected = (agent: Agent): boolean => agent.configDirs.some((dir) => existsSync(dir))

export function detectAgents(): Agent[] {
	return getAgents().filter(isDetected)
}

/** The one real copy; agents that read other directories get a symlink to it. */
export function sharedSkillDir(): string {
	return join(sharedSkillsDir(), SKILL_NAME)
}

export function skillDirFor(agent: Agent): string {
	return join(agent.skillsDir, SKILL_NAME)
}

export function parseSkillVersion(content: string): string | null {
	const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1]
	return frontmatter?.match(/^\s*version:\s*['"]?([^'"\s]+)['"]?\s*$/m)?.[1] ?? null
}

export function readSkillVersion(dir: string): string | null {
	try {
		return parseSkillVersion(readFileSync(join(dir, 'SKILL.md'), 'utf-8'))
	} catch {
		return null
	}
}

export function isOutdated(version: string): boolean {
	return valid(version) && valid(CLI_VERSION) ? lt(version, CLI_VERSION) : version !== CLI_VERSION
}

export function getSkillStatus(agents = getAgents()): SkillStatus[] {
	return agents.map((agent) => {
		const dir = skillDirFor(agent)
		return { agent, dir, detected: isDetected(agent), version: readSkillVersion(dir) }
	})
}

function readBundledSkill(): string {
	if (!PACKAGE_ROOT) {
		throw new Error('could not locate the qas-cli package directory')
	}
	return readFileSync(join(PACKAGE_ROOT, 'skills', SKILL_NAME, 'SKILL.md'), 'utf-8')
}

function isSymlink(path: string): boolean {
	try {
		return lstatSync(path).isSymbolicLink()
	} catch {
		return false
	}
}

function isRealDir(path: string): boolean {
	try {
		return lstatSync(path).isDirectory()
	} catch {
		return false
	}
}

function pointsTo(path: string, target: string): boolean {
	try {
		return realpathSync(path) === realpathSync(target)
	} catch {
		return false
	}
}

function writeSkill(dir: string, content: string): void {
	mkdirSync(dir, { recursive: true })
	const file = join(dir, 'SKILL.md')
	// Agents run several qasphere commands at once; the rename keeps readers off a half-written file
	const tmp = `${file}.${process.pid}.tmp`
	writeFileSync(tmp, content)
	renameSync(tmp, file)
}

/** Points `dir` at the shared copy, or copies the skill there when symlinks are unavailable. */
function linkSkill(dir: string, shared: string, content: string): boolean {
	if (isSymlink(dir) && pointsTo(dir, shared)) return true

	rmSync(dir, { recursive: true, force: true })
	mkdirSync(dirname(dir), { recursive: true })
	try {
		// Junctions need an absolute target. The relative one starts from the resolved parent so a
		// symlinked ~/.claude still reaches the shared copy.
		const target =
			process.platform === 'win32'
				? shared
				: relative(realpathSync(dirname(dir)), realpathSync(shared))
		symlinkSync(target, dir, 'junction')
		return true
	} catch {
		writeSkill(dir, content)
		return false
	}
}

export function installSkill(agents: Agent[]): InstallResult[] {
	const content = readBundledSkill()
	const shared = sharedSkillDir()
	// A symlinked shared copy (`npx skills add` from a local checkout) would have us write into its source
	if (!isRealDir(shared)) rmSync(shared, { recursive: true, force: true })
	writeSkill(shared, content)

	return agents.map((agent) => {
		const dir = skillDirFor(agent)
		if (dir === shared) return { agent, dir }
		return linkSkill(dir, shared, content) ? { agent, dir, linkedTo: shared } : { agent, dir }
	})
}

/** Removes the shared copy and every agent's link or copy, returning the removed directories. */
export function uninstallSkill(): string[] {
	const removed: string[] = []
	for (const dir of new Set([sharedSkillDir(), ...getAgents().map(skillDirFor)])) {
		if (!isSymlink(dir) && !existsSync(dir)) continue
		rmSync(dir, { recursive: true, force: true })
		removed.push(dir)
	}
	return removed
}

/** Updates installed copies older than the CLI and returns the updated directories. */
export function refreshSkill(): string[] {
	if (!PACKAGE_ROOT) return []

	const dirs = new Set([sharedSkillDir(), ...getAgents().map(skillDirFor)])
	const updated: string[] = []
	let content: string | undefined
	for (const dir of dirs) {
		// A symlink either points at a copy refreshed here or at a source checkout we must not write into
		if (!isRealDir(dir)) continue
		const version = readSkillVersion(dir)
		if (!version || !isOutdated(version)) continue
		content ??= readBundledSkill()
		writeSkill(dir, content)
		updated.push(dir)
	}
	return updated
}
