import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createProjectApi } from './projects'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import { withBaseUrl, withHeaders, withHttpRetry } from './utils'
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
		withHttpRetry(
			withHeaders(withBaseUrl(fetch, baseUrl), {
				Authorization: `ApiKey ${apiKey}`,
				'User-Agent': `qas-cli/${CLI_VERSION}`,
			})
		)
	)
