import { execFile } from 'node:child_process'

export function openBrowser(url: string): void {
	switch (process.platform) {
		case 'darwin':
			execFile('open', [url])
			break
		case 'win32':
			execFile('cmd', ['/c', 'start', '', url])
			break
		default:
			execFile('xdg-open', [url])
			break
	}
}
