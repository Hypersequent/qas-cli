import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createProjectApi } from './projects'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import { withApiKey, withBaseUrl, withHttpRetry } from './utils'

const getApi = (fetcher: typeof fetch) => {
	return {
		files: createFileApi(fetcher),
		folders: createFolderApi(fetcher),
		projects: createProjectApi(fetcher),
		runs: createRunApi(fetcher),
		testcases: createTCaseApi(fetcher),
	}
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, apiKey: string) =>
	getApi(withHttpRetry(withApiKey(withBaseUrl(fetch, baseUrl), apiKey)))
