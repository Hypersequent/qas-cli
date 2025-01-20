import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'
export interface PaginatedResponse<T> {
    data: T[]
    total: number
    page: number
    limit: number
}

export interface TCaseBySeq {
    id: string
    legacyId?: string
    seq: number
    version: number
    projectId: string
    folderId: number
}

export interface GetTCasesBySeqRequest {
    seqIds: string[]
    page?: number
    limit?: number
}

export const createTCaseApi = (fetcher: typeof fetch) => {
    fetcher = withJson(fetcher)
    return {
        getTCasesBySeq: (projectCode: ResourceId, request: GetTCasesBySeqRequest) =>
            fetcher(`/api/public/v0/project/${projectCode}/tcase/seq`, {
                method: 'POST',
                body: JSON.stringify(request),
            }).then((r) => jsonResponse<PaginatedResponse<TCaseBySeq>>(r)),
    }
}
