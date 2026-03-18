import { jsonResponse } from './utils'

export interface RemoteFile {
	id: string
	url: string
}

export const createFileApi = (fetcher: typeof fetch) => ({
	uploadFile: async (file: Blob, filename: string) => {
		const form = new FormData()
		form.append('file', file, filename)

		const res = await fetcher('/api/public/v0/file', {
			method: 'POST',
			body: form,
		})

		return jsonResponse<RemoteFile>(res)
	},

	uploadFiles: async (files: Array<{ blob: Blob; filename: string }>) => {
		const form = new FormData()
		for (const { blob, filename } of files) {
			form.append('files', blob, filename)
		}

		const res = await fetcher('/api/public/v0/file/batch', {
			method: 'POST',
			body: form,
		})

		const { files: uploaded } = await jsonResponse<{
			files: Array<{ id: string; url: string }>
		}>(res)
		return uploaded
	},
})
