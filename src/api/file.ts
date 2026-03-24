import { jsonResponse } from './utils'

export interface RemoteFile {
	id: string
	url: string
}

export const createFileApi = (fetcher: typeof fetch) => {
	const upload = async (files: Array<{ blob: Blob; filename: string }>) => {
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
	}

	return {
		upload,
		uploadFile: async (file: Blob, filename: string) => {
			const [uploaded] = await upload([{ blob: file, filename }])
			return uploaded
		},
		uploadFiles: upload,
	}
}
