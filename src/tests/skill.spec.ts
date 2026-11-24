import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	realpathSync,
	rmSync,
	symlinkSync,
	utimesSync,
	writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { run } from '../commands/main'
import { refreshAgentSkill } from '../commands/skill'
import { parseSkillVersion, readSkillVersion } from '../utils/skill'
import { CLI_VERSION, PACKAGE_ROOT } from '../utils/version'

const mockState = vi.hoisted(() => ({ testHomeDir: '', testTmpDir: '' }))

vi.mock('node:os', async () => {
	const actual = await vi.importActual<typeof import('node:os')>('node:os')
	return {
		...actual,
		homedir: () => mockState.testHomeDir,
		tmpdir: () => mockState.testTmpDir || actual.tmpdir(),
	}
})

const home = (...parts: string[]) => join(mockState.testHomeDir, ...parts)
const sharedDir = () => home('.agents', 'skills', 'qas-cli')
const claudeDir = () => home('.claude', 'skills', 'qas-cli')
const cursorDir = () => home('.cursor', 'skills', 'qas-cli')

function writeSkill(dir: string, version: string) {
	mkdirSync(dir, { recursive: true })
	writeFileSync(
		join(dir, 'SKILL.md'),
		`---\nname: qas-cli\nmetadata:\n  version: '${version}'\n---\n`
	)
}

const isLinkToShared = (dir: string) =>
	lstatSync(dir).isSymbolicLink() && realpathSync(dir) === realpathSync(sharedDir())

let log: ReturnType<typeof vi.spyOn>
let err: ReturnType<typeof vi.spyOn>
const output = (spy: ReturnType<typeof vi.spyOn>) => spy.mock.calls.flat().join('\n')

let testDir: string

beforeEach(() => {
	mockState.testTmpDir = ''
	testDir = join(tmpdir(), `qas-cli-skill-${Date.now()}-${Math.random().toString(36).slice(2)}`)
	mockState.testHomeDir = join(testDir, 'home')
	mockState.testTmpDir = join(testDir, 'tmp')
	mkdirSync(mockState.testHomeDir, { recursive: true })
	mkdirSync(mockState.testTmpDir)
	vi.stubEnv('CLAUDE_CONFIG_DIR', '')
	vi.stubEnv('CODEX_HOME', '')
	vi.stubEnv('XDG_CONFIG_HOME', '')
	vi.stubEnv('VIBE_HOME', '')
	log = vi.spyOn(console, 'log').mockImplementation(() => {})
	err = vi.spyOn(console, 'error').mockImplementation(() => {})
	vi.spyOn(process, 'exit').mockImplementation((() => {
		throw new Error('process.exit')
	}) as never)
})

afterEach(() => {
	rmSync(testDir, { recursive: true, force: true })
	vi.unstubAllEnvs()
	vi.restoreAllMocks()
})

describe('agent skill', () => {
	test('bundled skill version matches the package version', () => {
		const skill = readFileSync(join(PACKAGE_ROOT!, 'skills', 'qas-cli', 'SKILL.md'), 'utf-8')
		const pkg = JSON.parse(readFileSync(join(PACKAGE_ROOT!, 'package.json'), 'utf-8'))
		expect(parseSkillVersion(skill)).toBe(pkg.version)
	})

	test('install writes the shared copy and links detected agents to it', async () => {
		mkdirSync(home('.claude'))
		mkdirSync(home('.codex'))
		mkdirSync(home('.kilocode'))
		writeSkill(cursorDir(), '0.1.0')

		await run(['skill', 'install'])

		expect(readSkillVersion(sharedDir())).toBe(CLI_VERSION)
		expect(isLinkToShared(claudeDir())).toBe(true)
		// An older copy is replaced by a link
		expect(isLinkToShared(cursorDir())).toBe(true)
		// Detected through its legacy config directory
		expect(isLinkToShared(home('.kilo', 'skills', 'qas-cli'))).toBe(true)
		expect(existsSync(home('.gemini'))).toBe(false)
		expect(output(log)).toContain('Claude Code')
		expect(output(log)).toContain('Codex')
		expect(output(log)).toContain(
			'Codex, Cline, Zed, Warp and other agents that read ~/.agents/skills load it from there too.'
		)
	})

	test('install --agent targets agents that are not detected', async () => {
		await run(['skill', 'install', '--agent', 'gemini-cli'])

		expect(isLinkToShared(home('.gemini', 'skills', 'qas-cli'))).toBe(true)
		expect(existsSync(home('.claude'))).toBe(false)
	})

	test('install without a detected agent writes only the shared copy, which status lists', async () => {
		await run(['skill', 'install'])

		expect(readSkillVersion(sharedDir())).toBe(CLI_VERSION)
		expect(existsSync(home('.claude'))).toBe(false)
		expect(output(log)).toContain('No supported coding agents found.')
		expect(output(log)).toContain('https://qasphere.com/docs/cli/agent-skill/#other-agents')

		log.mockClear()
		await run(['skill', 'status'])

		const shared = output(log)
			.split('\n')
			.find((line) => line.includes('Shared copy'))
		expect(shared).toContain(`v${CLI_VERSION}`)
		expect(shared).toContain('~/.agents/skills/qas-cli')
		expect(output(log)).not.toContain('No supported coding agents found.')
	})

	test('status reports the installed version for each agent', async () => {
		mkdirSync(home('.claude'))
		await run(['skill', 'install'])
		writeSkill(cursorDir(), '0.1.0')
		mkdirSync(home('.gemini'))
		log.mockClear()

		await run(['skill', 'status'])

		const lines = output(log).split('\n')
		expect(lines.find((line) => line.includes('Claude Code'))).toContain(`v${CLI_VERSION}`)
		expect(lines.find((line) => line.includes('Cursor'))).toContain('v0.1.0 (outdated)')
		expect(lines.find((line) => line.includes('Gemini CLI'))).toContain('not installed')
		expect(output(log)).not.toContain('Codex')
	})

	test('refresh updates older copies and leaves links elsewhere alone', () => {
		writeSkill(sharedDir(), '0.1.0')
		writeSkill(cursorDir(), '0.1.0')
		const checkout = home('checkout', 'skills', 'qas-cli')
		writeSkill(checkout, '0.1.0')
		mkdirSync(home('.claude', 'skills'), { recursive: true })
		symlinkSync(checkout, claudeDir())

		refreshAgentSkill()

		expect(readSkillVersion(sharedDir())).toBe(CLI_VERSION)
		expect(readSkillVersion(cursorDir())).toBe(CLI_VERSION)
		expect(readSkillVersion(checkout)).toBe('0.1.0')
		expect(output(err)).toContain(`Updated the QA Sphere agent skill to v${CLI_VERSION}`)

		err.mockClear()
		refreshAgentSkill()
		expect(err).not.toHaveBeenCalled()
	})

	test('refresh does nothing when the skill is not installed', () => {
		mkdirSync(home('.claude'))

		refreshAgentSkill()

		expect(existsSync(home('.agents'))).toBe(false)
		expect(existsSync(claudeDir())).toBe(false)
		expect(err).not.toHaveBeenCalled()
	})

	test('a failed refresh warns at most once a day', () => {
		writeSkill(sharedDir(), '0.1.0')
		chmodSync(sharedDir(), 0o555)
		try {
			refreshAgentSkill()
			expect(output(err)).toContain('Could not update the QA Sphere agent skill')

			err.mockClear()
			refreshAgentSkill()
			expect(err).not.toHaveBeenCalled()

			const [marker] = readdirSync(mockState.testTmpDir)
			const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000)
			utimesSync(join(mockState.testTmpDir, marker), dayAgo, dayAgo)
			refreshAgentSkill()
			expect(output(err)).toContain('Could not update the QA Sphere agent skill')
		} finally {
			chmodSync(sharedDir(), 0o755)
		}
	})

	test('uninstall removes the shared copy and every agent link or copy', async () => {
		mkdirSync(home('.claude'))
		mkdirSync(home('.codex'))
		await run(['skill', 'install'])
		writeSkill(cursorDir(), '0.1.0')

		await run(['skill', 'uninstall'])

		expect(existsSync(sharedDir())).toBe(false)
		expect(lstatSync(claudeDir(), { throwIfNoEntry: false })).toBeUndefined()
		expect(existsSync(cursorDir())).toBe(false)

		log.mockClear()
		await run(['skill', 'uninstall'])
		expect(output(log)).toContain('not installed')
	})
})
