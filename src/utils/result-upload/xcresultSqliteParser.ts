import Database from 'better-sqlite3'
import chalk from 'chalk'
import escapeHtml from 'escape-html'
import { decompress } from 'fzstd'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { ResultStatus } from '../../api/schemas'
import { Attachment, TestCaseResult } from './types'
import { Parser } from './ResultUploadCommandHandler'

// Zstandard magic bytes: 0x28 0xB5 0x2F 0xFD
const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

const sqliteFile = 'database.sqlite3'
const dataDir = 'data' // Contains refs and data files
const dataFilePrefix = 'data.'
const ignoredAttachmentsPrefix = 'SynthesizedEvent_'

interface TestSuiteRow {
	rowid: number
	name: string | null
	parentSuite_fk: number | null
}

interface TestCaseRow {
	rowid: number
	testSuite_fk: number | null
	name: string | null
}

interface TestCaseRunRow {
	rowid: number
	testCase_fk: number | null
	result: string | null
	skipNotice_fk: number | null
}

interface AttachmentRow {
	rowid: number
	filenameOverride: string | null
	xcResultKitPayloadRefId: string | null

	// From JOIN with Activities table
	testCaseRun_fk: number | null
}

interface SkipNoticeRow {
	rowid: number
	message: string | null
}

interface ExpectedFailureRow {
	rowid: number
	testCaseRun_fk: number | null
	issue_fk: number | null
	failureReason: string | null
}

interface TestIssueRow {
	rowid: number
	testCaseRun_fk: number | null
	compactDescription: string | null
	detailedDescription: string | null
	sanitizedDescription: string | null
	sourceCodeContext_fk: number | null

	// From JOIN with SourceCodeContexts and SourceCodeLocations tables
	filePath: string | null
	lineNumber: number | null
}

interface SourceCodeFrameRow {
	rowid: number
	context_fk: number | null

	// From JOIN with SourceCodeSymbolInfos table
	symbolName: string | null

	// From JOIN with SourceCodeLocations table
	filePath: string | null
	lineNumber: number | null
}

export const printXCResultMissingMarkerGuidance = (
	projectCode: string,
	testCaseName = 'your_test_name'
) => {
	console.error(`
${chalk.yellow('To fix this issue, include the test case marker in your test names:')}

  Format: ${chalk.green(`${projectCode}_<sequence>`)}, ${chalk.dim(
		'where <sequence> is the test case number (minimum 3 digits, zero-padded if needed)'
	)}
  Example: ${chalk.green(`${projectCode}_002_${testCaseName}`)}
           ${chalk.green(`${testCaseName}_${projectCode}_1312`)}
`)
}

export const parseXCResult: Parser = async (bundlePath: string): Promise<TestCaseResult[]> => {
	const dbPath = path.join(bundlePath, sqliteFile)
	if (!existsSync(dbPath)) {
		// Following ensures that the sqlite path exist (is generated on first run)
		try {
			execSync(`xcrun xcresulttool get test-results summary --path "${bundlePath}"`, {
				stdio: 'ignore',
			})
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			throw new Error(`Failed to get test-results summary for ${bundlePath}: ${errorMessage}`)
		}
	}

	const db = new Database(dbPath, { readonly: true })

	try {
		const testSuitesIdToPathMap = getTestSuitesIdToPathMap(db)
		const testCasesIdToRowMap = getTestCasesIdToRowMap(db)
		const skipNoticesIdToMessageMap = getSkipNoticesIdToMessageMap(db)
		const testCaseRunIdToExpectedFailuresMap = getTestCaseRunIdToExpectedFailuresMap(db)
		const testIssues = getTestIssues(db)
		const sourceCodeContextIdToFramesMap = getSourceCodeContextIdToFramesMap(db)
		const testCaseRunIdToAttachmentsMap = getTestCaseRunIdToAttachmentsMap(db, bundlePath)

		const testCaseRuns = db
			.prepare('SELECT rowid, testCase_fk, result, skipNotice_fk FROM TestCaseRuns')
			.all() as TestCaseRunRow[]

		const results: TestCaseResult[] = []
		for (const testCaseRun of testCaseRuns) {
			const testCase = testCaseRun.testCase_fk ? testCasesIdToRowMap[testCaseRun.testCase_fk] : null
			if (!testCase) {
				continue
			}

			const folder = testCase.testSuite_fk
				? testSuitesIdToPathMap[testCase.testSuite_fk] ?? null
				: null
			const status = mapResultStatus(testCaseRun.result)
			const message = buildMessage(
				testCaseRun.rowid,
				status,
				testCaseRun.skipNotice_fk
					? skipNoticesIdToMessageMap[testCaseRun.skipNotice_fk] ?? null
					: null,
				testCaseRunIdToExpectedFailuresMap[testCaseRun.rowid],
				testIssues,
				sourceCodeContextIdToFramesMap
			)

			results.push({
				name: (testCase.name ?? 'Unknown Test').split('(')[0], // Names include "()" as well
				folder: folder ?? 'Unknown Suite',
				status,
				message,
				attachments: testCaseRunIdToAttachmentsMap[testCaseRun.rowid] ?? [],
			})
		}

		return results
	} finally {
		db.close()
	}
}

function getTestSuitesIdToPathMap(db: Database.Database): Record<number, string> {
	const rows = db
		.prepare('SELECT rowid, name, parentSuite_fk FROM TestSuites')
		.all() as TestSuiteRow[]

	const testSuitesMap: Record<number, TestSuiteRow> = {}
	for (const row of rows) {
		testSuitesMap[row.rowid] = row
	}

	const testSuitesPathMap: Record<number, string> = {}

	const getTestSuitePath = (testSuite: TestSuiteRow): string => {
		if (testSuitesPathMap[testSuite.rowid]) {
			return testSuitesPathMap[testSuite.rowid]
		}

		const parentSuite = testSuite.parentSuite_fk ? testSuitesMap[testSuite.parentSuite_fk] : null
		const parentSuitePath = parentSuite ? getTestSuitePath(parentSuite) : ''
		const path = `${parentSuitePath ? `${parentSuitePath} › ` : ''}${testSuite.name ?? ''}`

		// Also store the path in the map
		testSuitesPathMap[testSuite.rowid] = path
		return path
	}

	for (const testSuite of Object.values(testSuitesMap)) {
		getTestSuitePath(testSuite)
	}

	return testSuitesPathMap
}

function getTestCasesIdToRowMap(db: Database.Database): Record<number, TestCaseRow> {
	const rows = db.prepare('SELECT rowid, name, testSuite_fk FROM TestCases').all() as TestCaseRow[]

	const map: Record<number, TestCaseRow> = {}
	for (const row of rows) {
		map[row.rowid] = row
	}
	return map
}

function getSkipNoticesIdToMessageMap(db: Database.Database): Record<number, string> {
	const rows = db.prepare('SELECT rowid, message FROM SkipNotices').all() as SkipNoticeRow[]

	const map: Record<number, string> = {}
	for (const row of rows) {
		map[row.rowid] = row.message ?? ''
	}
	return map
}

function getTestCaseRunIdToExpectedFailuresMap(
	db: Database.Database
): Record<number, ExpectedFailureRow[]> {
	const rows = db
		.prepare(
			'SELECT rowid, issue_fk, testCaseRun_fk, failureReason FROM ExpectedFailures ORDER BY orderInOwner'
		)
		.all() as ExpectedFailureRow[]

	const map: Record<number, ExpectedFailureRow[]> = {}
	for (const row of rows) {
		if (!row.testCaseRun_fk) {
			continue
		}

		const expectedFailures = map[row.testCaseRun_fk] ?? []
		expectedFailures.push(row)
		map[row.testCaseRun_fk] = expectedFailures
	}
	return map
}

function getTestIssues(db: Database.Database): TestIssueRow[] {
	const rows = db
		.prepare(
			`SELECT
				ti.rowid,
				ti.testCaseRun_fk,
				ti.compactDescription,
				ti.detailedDescription,
				ti.sanitizedDescription,
				ti.sourceCodeContext_fk,
				scl.filePath,
				scl.lineNumber
			FROM TestIssues AS ti
			LEFT JOIN SourceCodeContexts AS scc ON scc.rowid = ti.sourceCodeContext_fk
			INNER JOIN SourceCodeLocations AS scl ON scl.rowid = scc.location_fk
			ORDER BY ti.testCaseRun_fk, ti.orderInOwner`
		)
		.all() as TestIssueRow[]

	return rows
}

function getSourceCodeContextIdToFramesMap(
	db: Database.Database
): Record<number, SourceCodeFrameRow[]> {
	const rows = db
		.prepare(
			`SELECT
				scf.rowid,
				scf.context_fk,
				scsi.symbolName,
				scl.filePath,
				scl.lineNumber
			FROM SourceCodeFrames AS scf
			INNER JOIN SourceCodeSymbolInfos AS scsi ON scsi.rowid = scf.symbolinfo_fk
			INNER JOIN SourceCodeLocations AS scl ON scl.rowid = scsi.location_fk
			WHERE scf.symbolInfo_fk IS NOT NULL
			ORDER BY scf.context_fk, scf.orderInContainer`
		)
		.all() as SourceCodeFrameRow[]

	const map: Record<number, SourceCodeFrameRow[]> = {}
	for (const row of rows) {
		if (!row.context_fk) {
			continue
		}

		const context = map[row.context_fk] ?? []
		context.push(row)
		map[row.context_fk] = context
	}
	return map
}

function getTestCaseRunIdToAttachmentsMap(
	db: Database.Database,
	baseDir: string
): Record<number, Attachment[]> {
	const rows = db
		.prepare(
			`SELECT
				att.rowid,
				att.filenameOverride,
				att.xcResultKitPayloadRefId,
				act.testCaseRun_fk
			FROM Attachments AS att
			INNER JOIN Activities AS act ON att.activity_fk = act.rowid`
		)
		.all() as AttachmentRow[]

	const map: Record<number, Attachment[]> = {}
	for (const row of rows) {
		if (!row.testCaseRun_fk || !row.filenameOverride || !row.xcResultKitPayloadRefId) {
			continue
		}

		if (row.filenameOverride.startsWith(ignoredAttachmentsPrefix)) {
			continue
		}

		const buffer = readDataBlob(baseDir, row.xcResultKitPayloadRefId)
		if (!buffer) {
			continue
		}

		const attachments = map[row.testCaseRun_fk] ?? []
		attachments.push({
			filename: row.filenameOverride,
			buffer,
			error: null,
		})
		map[row.testCaseRun_fk] = attachments
	}
	return map
}

function readDataBlob(baseDir: string, refId: string): Buffer | null {
	const filename = `${dataFilePrefix}${refId}`
	const filepath = path.join(baseDir, dataDir, filename)

	if (!existsSync(filepath)) {
		return null
	}

	const rawData = readFileSync(filepath)
	if (isZstdCompressed(rawData)) {
		return Buffer.from(decompress(rawData))
	}

	return rawData
}

function isZstdCompressed(data: Buffer): boolean {
	if (data.length < 4) return false
	return data.subarray(0, 4).equals(ZSTD_MAGIC)
}

function mapResultStatus(result: string | null): ResultStatus {
	switch (result?.toLowerCase() ?? null) {
		case 'success':
			return 'passed'
		case 'failure':
			return 'failed'
		case 'skipped':
			return 'skipped'
		case 'expected failure':
			return 'blocked'
	}

	return 'skipped'
}

function buildMessage(
	testCaseRunId: number,
	status: ResultStatus,
	skipNotice: string | null,
	expectedFailures: ExpectedFailureRow[] | null,
	allTestIssues: TestIssueRow[],
	sourceCodeContextIdToFramesMap: Record<number, SourceCodeFrameRow[]>
): string {
	let message = ''

	if (status === 'skipped' && skipNotice) {
		message += `<p><strong>Skipped Reason:</strong> ${escapeHtml(skipNotice)}</p>`
	}

	if (status === 'blocked' && expectedFailures) {
		for (let i = 0; i < expectedFailures.length; i++) {
			const expectedFailure = expectedFailures[i]
			const issue = expectedFailure.issue_fk
				? allTestIssues?.find((ti) => ti.rowid === expectedFailure.issue_fk)
				: null

			message += `${i > 0 ? '<br><br>' : ''}<p><strong>Expected Failure:</strong> ${escapeHtml(
				expectedFailure.failureReason
			)}</p>`
			if (issue) {
				const issueMessage = getIssueMessage(
					issue,
					sourceCodeContextIdToFramesMap,
					'&nbsp;&nbsp;&nbsp;&nbsp;'
				)
				if (issueMessage) {
					message += issueMessage
				}
			}
		}
	}

	if (status === 'failed') {
		let addSeparation = false
		const issues = allTestIssues.filter((ti) => ti.testCaseRun_fk === testCaseRunId)

		for (const issue of issues) {
			const issueMessage = getIssueMessage(issue, sourceCodeContextIdToFramesMap)
			if (issueMessage) {
				message += `${addSeparation ? '<br><br>' : ''}<p>${issueMessage}</p>`
				addSeparation = true
			}
		}
	}

	return message
}

function getIssueMessage(
	issue: TestIssueRow,
	sourceCodeContextIdToFramesMap: Record<number, SourceCodeFrameRow[]>,
	indent = ''
) {
	let issueMessage =
		issue.detailedDescription || issue.sanitizedDescription || issue.compactDescription || ''

	if (!issueMessage) {
		return ''
	}

	issueMessage = `${indent}<strong>${escapeHtml(issueMessage)}</strong>`
	if (issue.filePath && issue.lineNumber) {
		issueMessage += ` (at ${escapeHtml(issue.filePath)}:${issue.lineNumber})<br>`
	}

	const frames = issue.sourceCodeContext_fk
		? sourceCodeContextIdToFramesMap[issue.sourceCodeContext_fk]
		: null
	if (frames?.length) {
		for (const frame of frames) {
			issueMessage += `${indent}&nbsp;&nbsp;&nbsp;&nbsp;<strong>${escapeHtml(
				frame.symbolName ?? '??'
			)}</strong>`
			if (frame.filePath && frame.lineNumber) {
				issueMessage += ` (at ${escapeHtml(frame.filePath)}:${frame.lineNumber})`
			}
			issueMessage += `<br>`
		}
	}

	return issueMessage
}
