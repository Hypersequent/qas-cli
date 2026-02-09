import { SetupServerApi } from 'msw/node'
import { randomBytes } from 'node:crypto'
import { unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const countMockedApiCalls = (
	server: SetupServerApi,
	url: string | RegExp | ((req: Request) => boolean)
) => {
	let count = 0
	const checkEvent = (e: { request: Request }) => {
		if (typeof url === 'string') {
			return url === e.request.url
		}
		if (url instanceof RegExp) {
			return url.test(e.request.url)
		}
		return url(e.request)
	}
	server.events.on('response:mocked', (e) => {
		if (checkEvent(e)) {
			count++
		}
	})
	return () => count
}

/**
 * Creates a temp file with the provided content in the OS temp directory and returns its path.
 * @param content Content to be written to the temp file
 * @param extension Extension of the file
 * @returns string Path of the created temp file
 */
export function createTempFile(content: string, extension: string) {
	const randomName = `tmp-${randomBytes(8).toString('hex')}.${extension}`
	const tmpPath = join(tmpdir(), randomName)
	writeFileSync(tmpPath, content, { encoding: 'utf-8' })
	return tmpPath
}

/**
 * Deletes the file at the given path.
 * @param filePath Path to the file to delete
 */
export function deleteTempFile(filePath: string) {
	unlinkSync(filePath)
}
