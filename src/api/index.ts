import { createProjectApi } from './projects'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import { createFileApi } from './file'
import { withApiKey, withBaseUrl } from './utils'

const getApi = (fetcher: typeof fetch) => {
    return {
        projects: createProjectApi(fetcher),
        runs: createRunApi(fetcher),
        testcases: createTCaseApi(fetcher),
        file: createFileApi(fetcher),
    }
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, apiKey: string) =>
    getApi(withApiKey(withBaseUrl(fetch, baseUrl), apiKey))