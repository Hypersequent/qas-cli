import { jsonResponse } from './utils'

export const createFileApi = (fetcher: typeof fetch) => ({
	uploadFile: async (file: File) => {
		const form = new FormData()
		form.append('file', file)

		const res = await fetcher(`/api/public/v0/file`, {
			method: 'POST',
			body: form,
		})

		return jsonResponse<{ id: string; url: string }>(res)
	},
})
