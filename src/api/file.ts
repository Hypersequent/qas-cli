import { jsonResponse } from './utils'

export const createFileApi = (fetcher: typeof fetch) => ({
	uploadFile: async (file: Blob, filename: string) => {
		const form = new FormData()
		form.append('file', file, filename)

		const res = await fetcher('/api/public/v0/file', {
			method: 'POST',
			body: form,
		})

		return jsonResponse<{ id: string; url: string }>(res)
	},
})
