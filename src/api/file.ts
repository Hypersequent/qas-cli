import { jsonResponse } from './utils'

export const createFileApi = (fetcher: typeof fetch) => ({
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
