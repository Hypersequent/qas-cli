import { readFile } from 'fs/promises'
import path, { basename } from 'path'
import { Attachment } from './types'

const getFile = async (filePath: string, basePath?: string): Promise<Buffer> => {
	try {
		return readFile(basePath ? path.join(basePath, filePath) : filePath)
	} catch (e) {
		if (
			e &&
			typeof e === 'object' &&
			'code' in e &&
			typeof e.code === 'string' &&
			e.code === 'ENOENT'
		) {
			throw new Error(`Attachment not found: "${filePath}"`)
		}
		throw e
	}
}

export const getAttachments = async (
	filePaths: string[],
	basePath?: string
): Promise<Attachment[]> => {
	return Promise.allSettled(filePaths.map((p) => getFile(p, basePath))).then((results) => {
		return results.map((p, i) => ({
			filename: basename(filePaths[i]),
			buffer: p.status === 'fulfilled' ? p.value : null,
			error: p.status === 'fulfilled' ? null : p.reason,
		}))
	})
}
