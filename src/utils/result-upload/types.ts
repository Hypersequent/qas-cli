import { ResultStatus } from '../../api/schemas'

export interface Attachment {
	buffer: Buffer | null
	error: Error | null
	filename: string
}

export interface TestCaseResult {
	name?: string
	folder?: string
	status: ResultStatus
	message?: string
	attachments: Attachment[]
}
