import { execFile } from 'node:child_process'

const onError = (err: Error | null) => {
	if (err) console.error('Could not open browser. Please visit the URL manually.')
}

export function openBrowser(url: string): void {
	new URL(url) // Validate URL to prevent shell injection

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
