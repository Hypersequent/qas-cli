import { ResourceId } from './schemas'
import { jsonResponse, withJson } from './utils'

export interface TCaseBySeq {
	id: string
	legacyId?: string
	seq: number
	version: number
	projectId: string
	folderId: number
}

export interface GetTCasesBySeqRequest {
	seqIds?: string[]
	seqs?: number[]
	range?: {
		from: number
		to: number
	}
}

export interface GetTCasesBySeqResponse {
	tcases: TCaseBySeq[]
}

export const createTCaseApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		getTCasesBySeq: (projectCode: ResourceId, request: GetTCasesBySeqRequest) =>
			fetcher(`/api/public/v0/project/${projectCode}/tcase/seq`, {
				method: 'POST',
				body: JSON.stringify(request),
			}).then((r) => jsonResponse<GetTCasesBySeqResponse>(r)),
	}
}
