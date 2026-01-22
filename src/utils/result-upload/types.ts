import { ResultStatus } from '../../api/schemas'

export interface Attachment {
	filename: string
	buffer: Buffer | null
	error: Error | null
}

export interface TestCaseResult {
	// Name of the test case extracted from the report. In case of nested suites, it might contain name of
	// parent suites as well. Useful for logging and extracting QA Sphere sequence number for the test case
	name: string
	// Name of the test file (or the suite) to which the test belongs, useful for logging purposes
	folder: string
	status: ResultStatus
	message: string
	timeTaken: number | null // In milliseconds
	attachments: Attachment[]
}
