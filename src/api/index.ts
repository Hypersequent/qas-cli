import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createProjectApi } from './projects'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import { withFetchMiddlewares, withBaseUrl, withAuth, withUserAgent, withHttpRetry } from './utils'
import type { AuthType } from './utils'
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

export const createApi = (baseUrl: string, token: string, authType: AuthType = 'apikey') =>
	getApi(
		withFetchMiddlewares(
			fetch,
			withBaseUrl(baseUrl),
			withUserAgent(CLI_VERSION),
			withAuth(token, authType),
			withHttpRetry
		)
	)
