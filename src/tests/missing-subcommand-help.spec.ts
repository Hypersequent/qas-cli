import { describe, expect, test, vi } from 'vitest'

import { run } from '../commands/main.js'

/**
 * When a user runs a command group without specifying a leaf subcommand
 * (e.g. `qasphere api` or `qasphere api projects`), the CLI should
 * display help text instead of "An unexpected error occurred."
 */
describe('missing subcommand shows help', () => {
	function setup() {
		const exitSpy = vi
			.spyOn(process, 'exit')
			.mockImplementation((() => {}) as unknown as typeof process.exit)
		const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

		return {
			exitSpy,
			stderrSpy,
			logSpy,
			collectLog: () => logSpy.mock.calls.map((c) => c.join(' ')).join('\n'),
			collectStderr: () => stderrSpy.mock.calls.map((c) => c.join(' ')).join('\n'),
			reset() {
				exitSpy.mockClear()
				stderrSpy.mockClear()
				logSpy.mockClear()
			},
			restore() {
				exitSpy.mockRestore()
				stderrSpy.mockRestore()
				logSpy.mockRestore()
			},
		}
	}

	test.each([
		{ args: ['api'], label: '`api`' },
		{ args: ['api', 'projects'], label: '`api projects`' },
		{ args: ['api', 'runs'], label: '`api runs`' },
	])('$label without subcommand shows help', async ({ args }) => {
		const spies = setup()
		try {
			// Capture the canonical help text via -h (printed to stdout).
			// Vitest replaces process.exit with a function that throws, so we catch it.
			try {
				await run([...args, '-h'])
			} catch {
				// expected: vitest's process.exit always throws
			}
			const helpText = spies.collectLog()
			expect(helpText).toContain('Commands:')
			expect(helpText).toContain(args.join(' '))

			spies.reset()

			// Run without subcommand — should print the same help to stderr
			await run(args)
			expect(spies.exitSpy).toHaveBeenCalledWith(1)
			const stderrOutput = spies.collectStderr()
			expect(stderrOutput).not.toContain('An unexpected error occurred')
			expect(stderrOutput).toContain(helpText)
		} finally {
			spies.restore()
		}
	})

	test.each([
		{ args: ['api', 'runs', 'test'], label: '`api runs test`' },
		{
			args: ['api', 'runs', 'test-cases', 'nonexistent'],
			label: '`api runs test-cases nonexistent`',
		},
		{ args: ['api', 'blah'], label: '`api blah`' },
	])('$label with unknown subcommand shows help and exits with error', async ({ args }) => {
		const spies = setup()
		try {
			await run(args)
			// The first process.exit call determines the real exit code
			expect(spies.exitSpy.mock.calls[0][0]).toBe(1)
			expect(spies.exitSpy).not.toHaveBeenCalledWith(0)
			const stderrOutput = spies.collectStderr()
			expect(stderrOutput).toMatch(/Unknown argument/)
		} finally {
			spies.restore()
		}
	})

	test('no args shows help with exit code 0', async () => {
		const spies = setup()
		try {
			await run([])
			expect(spies.exitSpy).toHaveBeenCalledWith(0)
		} finally {
			spies.restore()
		}
	})
})
