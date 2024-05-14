import { createRunApi } from './run'
import { withApiKey, withBaseUrl, withJson } from './utils'

const getApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)

	return {
		runs: createRunApi(fetcher),
	}
}

export const createApi = (baseUrl: string, apiKey: string) =>
	getApi(withApiKey(withBaseUrl(fetch, baseUrl), apiKey))
