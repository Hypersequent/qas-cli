import { execFile } from 'node:child_process'

const onError = (err: Error | null, _stdout: string, stderr: string) => {
	if (!err) return
	const detail = stderr.trim()
	const suffix = detail ? ` (${detail})` : ''
	console.error(`Could not open browser${suffix}. Please visit the URL manually.`)
}

export function openBrowser(url: string): void {
	const parsed = new URL(url)
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(`Refusing to open browser for non-http(s) URL: ${parsed.protocol}`)
	}

	switch (process.platform) {
		case 'darwin':
			execFile('open', [url], onError)
			break
		case 'win32':
			execFile('cmd', ['/c', 'start', '', url], onError)
			break
		default:
			execFile('xdg-open', [url], onError)
			break
	}
}
