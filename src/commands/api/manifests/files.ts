import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { printJson, apiDocsEpilog } from '../utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	upload: {
		describe: 'Upload a file attachment via the public batch upload endpoint.',
		epilog: apiDocsEpilog('upload_file', 'upload-file'),
		examples: [
			{
				usage: '$0 api files upload --file ./screenshot.png',
				description: 'Upload a single file using the batch upload endpoint',
			},
		],
	},
} as const

const upload: ApiEndpointSpec = {
	id: 'files.upload',
	commandPath: ['files', 'upload'],
	describe: help.upload.describe,
	bodyMode: 'file',
	maxSize: 1024 * 1024 * 50,
	pathParams: [],
	epilog: help.upload.epilog,
	examples: help.upload.examples,
	execute: async (api, { body }) => {
		const filePath = body as string
		const filename = basename(filePath)
		const blob = new Blob([await readFile(filePath)])
		const [result] = await api.files.upload([{ blob, filename }])
		printJson(result)
	},
}

export const fileSpecs: ApiEndpointSpec[] = [upload]
