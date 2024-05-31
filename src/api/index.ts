import { createFileApi } from './file'
import { createRunApi } from './run'
import { withApiKey, withBaseUrl } from './utils'

const getApi = (fetcher: typeof fetch) => {
	return {
		runs: createRunApi(fetcher),
		file: createFileApi(fetcher),
	}
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, apiKey: string) =>
	getApi(withApiKey(withBaseUrl(fetch, baseUrl), apiKey))
