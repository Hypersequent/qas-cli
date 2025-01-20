import { createFileApi } from './file'
import { createRunApi } from './run'
import { createTCaseApi } from './tcases'
import { withApiKey, withBaseUrl } from './utils'

const getApi = (fetcher: typeof fetch) => {
    return {
        runs: createRunApi(fetcher),
        file: createFileApi(fetcher),
        testcases: createTCaseApi(fetcher),
    }
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, apiKey: string) =>
    getApi(withApiKey(withBaseUrl(fetch, baseUrl), apiKey))