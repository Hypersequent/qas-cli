import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const execFileMock = vi.hoisted(() => vi.fn())

vi.mock('node:child_process', () => ({
	execFile: execFileMock,
}))

describe('openBrowser', () => {
	let err: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		execFileMock.mockReset()
		err = vi.spyOn(console, 'error').mockImplementation(() => {})
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	test('throws on javascript: URLs', async () => {
		const { openBrowser } = await import('../utils/browser')
		expect(() => openBrowser('javascript:alert(1)')).toThrow(/non-http\(s\)/)
		expect(execFileMock).not.toHaveBeenCalled()
	})

	test('throws on file: URLs', async () => {
		const { openBrowser } = await import('../utils/browser')
		expect(() => openBrowser('file:///etc/passwd')).toThrow(/non-http\(s\)/)
		expect(execFileMock).not.toHaveBeenCalled()
	})

	test('throws on data: URLs', async () => {
		const { openBrowser } = await import('../utils/browser')
		expect(() => openBrowser('data:text/html,<script>alert(1)</script>')).toThrow(/non-http\(s\)/)
		expect(execFileMock).not.toHaveBeenCalled()
	})

	test('accepts http URLs', async () => {
		const { openBrowser } = await import('../utils/browser')
		openBrowser('http://example.com')
		expect(execFileMock).toHaveBeenCalledOnce()
	})

	test('accepts https URLs', async () => {
		const { openBrowser } = await import('../utils/browser')
		openBrowser('https://example.com/path?q=1')
		expect(execFileMock).toHaveBeenCalledOnce()
	})

	test('throws on malformed URL', async () => {
		const { openBrowser } = await import('../utils/browser')
		expect(() => openBrowser('not a url')).toThrow()
		expect(execFileMock).not.toHaveBeenCalled()
	})

	test('includes stderr in error message on failure', async () => {
		execFileMock.mockImplementation(
			(
				_cmd: string,
				_args: string[],
				cb: (err: Error | null, stdout: string, stderr: string) => void
			) => {
				cb(new Error('spawn failed'), '', 'xdg-open: no application registered')
			}
		)
		const { openBrowser } = await import('../utils/browser')
		openBrowser('http://example.com')
		expect(err).toHaveBeenCalledWith(expect.stringContaining('no application registered'))
		expect(err).toHaveBeenCalledWith(expect.stringContaining('visit the URL manually'))
	})

	test('omits parenthetical when stderr is empty', async () => {
		execFileMock.mockImplementation(
			(
				_cmd: string,
				_args: string[],
				cb: (err: Error | null, stdout: string, stderr: string) => void
			) => {
				cb(new Error('spawn failed'), '', '')
			}
		)
		const { openBrowser } = await import('../utils/browser')
		openBrowser('http://example.com')
		const call = err.mock.calls[0]?.[0] as string
		expect(call).toBe('Could not open browser. Please visit the URL manually.')
	})

	test('no error logged when execFile callback reports success', async () => {
		execFileMock.mockImplementation(
			(
				_cmd: string,
				_args: string[],
				cb: (err: Error | null, stdout: string, stderr: string) => void
			) => {
				cb(null, '', '')
			}
		)
		const { openBrowser } = await import('../utils/browser')
		openBrowser('http://example.com')
		expect(err).not.toHaveBeenCalled()
	})
})
