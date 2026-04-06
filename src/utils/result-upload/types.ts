import { ResultStatus } from '../../api/schemas'

export interface Attachment {
	filename: string
	filePath: string
	buffer: Buffer | null
	error: Error | null
}

export interface TestCaseMarker {
	projectCode: string
	seq: number
}

export type MarkerResolution = 'resolved' | 'resolved-none' | 'needs-project-resolution'

export interface TestCaseResult {
	// Name of the test case extracted from the report. In case of nested suites, it might contain name of
	// parent suites as well. Useful for logging and user-facing diagnostics.
	name: string
	// Explicit marker metadata used for mapping to run test cases. Prefer this over parsing the display name.
	marker: TestCaseMarker | null
	// Controls whether the handler may perform project-aware fallback resolution.
	markerResolution: MarkerResolution
	// Set for intentional fan-in cases such as repeated create-tcases titles that should share one target test case.
	allowDuplicateTarget?: boolean
	// Name of the test file (or the suite) to which the test belongs, useful for logging purposes
	folder: string
	status: ResultStatus
	message: string
	timeTaken: number | null // In milliseconds
	attachments: Attachment[]
}

export interface ParseResult {
	testCaseResults: TestCaseResult[]
	runFailureLogs: string // HTML string, empty if no global/suite-level issues
}
