import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createProjectApi } from './projects'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import {
	withFetchMiddlewares,
	withBaseUrl,
	withApiKey,
	withUserAgent,
	withHttpRetry,
} from './utils'
import { CLI_VERSION } from '../utils/version'

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
	getApi(
		withFetchMiddlewares(
			fetch,
			withBaseUrl(baseUrl),
			withUserAgent(CLI_VERSION),
			withApiKey(apiKey),
			withHttpRetry
		)
	)
