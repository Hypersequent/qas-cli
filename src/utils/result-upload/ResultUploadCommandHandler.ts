import { Arguments } from 'yargs'
import chalk from 'chalk'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { getTCaseMarker, parseRunUrl, printErrorThenExit, processTemplate } from '../misc'
import { Api, createApi } from '../../api'
import { TCase } from '../../api/schemas'
import { TestCaseResult } from './types'
import { ResultUploader } from './ResultUploader'
import { parseJUnitXml } from './junitXmlParser'
import { parsePlaywrightJson } from './playwrightJsonParser'
import { parseAllureResults } from './allureParser'

export type UploadCommandType = 'junit-upload' | 'playwright-json-upload' | 'allure-upload'

export type SkipOutputOption = 'on-success' | 'never'

export interface ParserOptions {
	skipStdout: SkipOutputOption
	skipStderr: SkipOutputOption
}

export type Parser = (
	// Primary input string: file content for file-based parsers, directory path for
	// directory-based parsers (e.g., Allure)
	data: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
) => Promise<TestCaseResult[]>

export type ResultUploadCommandArgs = {
	type: UploadCommandType
	files: string[]
	force: boolean
	attachments: boolean
	ignoreUnmatched: boolean
	skipReportStdout: SkipOutputOption
	skipReportStderr: SkipOutputOption
} & (
	| {
			runUrl: string
	  }
	| {
			projectCode?: string
			runName?: string
			createTcases: boolean
	  }
)

interface FileResults {
	file: string
	results: TestCaseResult[]
}

interface TestCaseResultWithSeqAndFile {
	seq: number | null
	file: string
	result: TestCaseResult
}

const DEFAULT_PAGE_SIZE = 5000
export const DEFAULT_FOLDER_TITLE = 'cli-import'
const DEFAULT_TCASE_TAGS = ['cli-import']
const DEFAULT_MAPPING_FILENAME_TEMPLATE = 'qasphere-automapping-{YYYY}{MM}{DD}-{HH}{mm}{ss}.txt'
const commandTypeParsers: Record<UploadCommandType, Parser> = {
	'junit-upload': parseJUnitXml,
	'playwright-json-upload': parsePlaywrightJson,
	'allure-upload': parseAllureResults,
}

const directoryInputTypes: Set<UploadCommandType> = new Set(['allure-upload'])

export class ResultUploadCommandHandler {
	private api: Api
	private baseUrl: string

	constructor(
		private type: UploadCommandType,
		private args: Arguments<ResultUploadCommandArgs>
	) {
		const apiToken = process.env.QAS_TOKEN!

		this.baseUrl = process.env.QAS_URL!.replace(/\/+$/, '')
		this.api = createApi(this.baseUrl, apiToken)
	}

	async handle() {
		if (!this.args.files || this.args.files.length === 0) {
			return printErrorThenExit('No files specified')
		}

		let fileResults = await this.parseFiles()
		let projectCode = ''
		let runId = 0

		if ('runUrl' in this.args && this.args.runUrl) {
			// Handle existing run URL
			console.log(chalk.blue(`Using existing test run: ${this.args.runUrl}`))

			const urlParsed = parseRunUrl(this.args)
			if (urlParsed.url !== this.baseUrl) {
				printErrorThenExit(
					`Invalid --run-url specified. Must be in the format: ${this.baseUrl}/project/PROJECT/run/RUN`
				)
			}

			runId = urlParsed.run
			projectCode = urlParsed.project
		} else {
			if (this.args.projectCode) {
				projectCode = this.args.projectCode as string
			} else {
				// Try to auto-detect project code from results. This is not fully reliable, but
				// is kept for backward compatibility. Better to specify project code explicitly
				projectCode = this.detectProjectCodeFromTCaseNames(fileResults)
				console.log(chalk.blue(`Detected project code: ${projectCode}`))
			}

			if (!(await this.api.projects.checkProjectExists(projectCode))) {
				return printErrorThenExit(`Project ${projectCode} does not exist`)
			}

			const resp = await this.getTCaseIds(projectCode, fileResults)
			fileResults = resp.fileResults
			runId = await this.createNewRun(projectCode, resp.tcaseIds)
		}

		const results = fileResults.flatMap((fileResult) => fileResult.results)
		await this.uploadResults(projectCode, runId, results)
	}

	protected async parseFiles(): Promise<FileResults[]> {
		const results: FileResults[] = []

		const parserOptions: ParserOptions = {
			skipStdout: this.args.skipReportStdout,
			skipStderr: this.args.skipReportStderr,
		}

		for (const file of this.args.files) {
			let fileData: string
			let attachmentBaseDir: string

			if (directoryInputTypes.has(this.type)) {
				// For directory-based parsers (e.g., Allure), pass the directory path directly
				fileData = file
				attachmentBaseDir = file
			} else {
				fileData = readFileSync(file).toString()
				attachmentBaseDir = dirname(file)
			}

			const fileResults = await commandTypeParsers[this.type](
				fileData,
				attachmentBaseDir,
				parserOptions
			)
			results.push({ file, results: fileResults })
		}

		return results
	}

	protected detectProjectCodeFromTCaseNames(fileResults: FileResults[]) {
		// Look for pattern like PRJ-123 or TEST-456
		const tcaseSeqPattern = String.raw`([A-Za-z0-9]{1,5})-\d{3,}`
		for (const { results } of fileResults) {
			for (const result of results) {
				if (result.name) {
					const match = this.execRegexWithPriority(tcaseSeqPattern, result.name)
					if (match) {
						return match[1]
					}
				}
			}
		}

		return printErrorThenExit(
			'Could not detect project code from test case names. Please specify project code using --project-code flag'
		)
	}

	private execRegexWithPriority(pattern: string, str: string): RegExpExecArray | null {
		// Try matching at start first
		const startRegex = new RegExp(`^${pattern}`)
		let match = startRegex.exec(str)
		if (match) return match

		// Try matching at end
		const endRegex = new RegExp(`${pattern}$`)
		match = endRegex.exec(str)
		if (match) return match

		// Fall back to matching anywhere
		const anywhereRegex = new RegExp(pattern)
		return anywhereRegex.exec(str)
	}

	protected async getTCaseIds(projectCode: string, fileResults: FileResults[]) {
		const shouldFailOnInvalid = !this.args.force && !this.args.ignoreUnmatched
		const tcaseSeqPattern = String.raw`${projectCode}-(\d{3,})`

		const seqIdsSet: Set<number> = new Set()
		const resultsWithSeqAndFile: TestCaseResultWithSeqAndFile[] = []

		// First extract the sequence numbers from the test case names
		for (const { file, results } of fileResults) {
			for (const result of results) {
				if (!result.name) {
					if (shouldFailOnInvalid) {
						return printErrorThenExit(`Test case in ${file} has no name`)
					}
					continue
				}

				const match = this.execRegexWithPriority(tcaseSeqPattern, result.name)
				resultsWithSeqAndFile.push({
					seq: match ? Number(match[1]) : null,
					file,
					result,
				})

				if (match) {
					seqIdsSet.add(Number(match[1]))
				}
			}
		}

		// Now fetch the test cases by their sequence numbers
		const apiTCasesMap: Record<number, TCase> = {}
		if (seqIdsSet.size > 0) {
			const tcaseMarkers = Array.from(seqIdsSet).map((v) => getTCaseMarker(projectCode, v))

			for (let page = 1; ; page++) {
				const response = await this.api.testcases.getTCasesBySeq(projectCode, {
					seqIds: tcaseMarkers,
					page,
					limit: DEFAULT_PAGE_SIZE,
				})

				for (const tcase of response.data) {
					apiTCasesMap[tcase.seq] = tcase
				}

				if (response.data.length < DEFAULT_PAGE_SIZE) {
					break
				}
			}
		}

		// Now validate that the test cases with found sequence numbers actually exist
		const tcaseIds: string[] = []
		const tcasesToCreateMap: Record<string, TestCaseResult[]> = {}
		for (const { seq, file, result } of resultsWithSeqAndFile) {
			if (seq && apiTCasesMap[seq]) {
				tcaseIds.push(apiTCasesMap[seq].id)
				continue
			}

			if (this.args.createTcases) {
				const tcaseResults = tcasesToCreateMap[result.name] || []
				tcaseResults.push(result)
				tcasesToCreateMap[result.name] = tcaseResults
				continue
			}

			if (shouldFailOnInvalid) {
				return printErrorThenExit(
					`Test case name "${result.name}" in ${file} does not contain valid sequence number with project code (e.g., ${projectCode}-123)`
				)
			}
		}

		// Create new test cases, if same is requested
		if (Object.keys(tcasesToCreateMap).length > 0) {
			const keys = Object.keys(tcasesToCreateMap)
			const newTCases = await this.createNewTCases(projectCode, keys)

			for (let i = 0; i < keys.length; i++) {
				const marker = getTCaseMarker(projectCode, newTCases[i].seq)
				for (const result of tcasesToCreateMap[keys[i]] || []) {
					// Prefix the test case markers for use in ResultUploader. The fileResults array
					// containing the updated name is returned to the caller
					result.name = `${marker}: ${result.name}`
				}
				tcaseIds.push(newTCases[i].id)
			}
		}

		if (tcaseIds.length === 0) {
			return printErrorThenExit('No valid test cases found in any of the files')
		}

		return { tcaseIds, fileResults }
	}

	private async createNewTCases(projectCode: string, tcasesToCreate: string[]) {
		console.log(chalk.blue(`Creating test cases for results with no test case markers`))

		// First fetch the default folder ID where we are creating new test cases.
		// Ideally, there shouldn't be the need to fetch more than one page.
		let defaultFolderId = null
		for (let page = 1; ; page++) {
			const response = await this.api.folders.getFoldersPaginated(projectCode, {
				search: DEFAULT_FOLDER_TITLE,
				page,
				limit: DEFAULT_PAGE_SIZE,
			})

			for (const folder of response.data) {
				if (folder.title === DEFAULT_FOLDER_TITLE && !folder.parentId) {
					defaultFolderId = folder.id
					break
				}
			}

			if (defaultFolderId || response.data.length < DEFAULT_PAGE_SIZE) {
				break
			}
		}

		// If the default folder exists, fetch the test cases in it
		const apiTCasesMap: Record<string, TCase> = {}
		if (defaultFolderId) {
			for (let page = 1; ; page++) {
				const response = await this.api.testcases.getTCasesPaginated(projectCode, {
					folders: [defaultFolderId],
					page,
					limit: DEFAULT_PAGE_SIZE,
				})

				for (const tcase of response.data) {
					apiTCasesMap[tcase.title] = tcase
				}

				if (response.data.length < DEFAULT_PAGE_SIZE) {
					break
				}
			}
		}

		// Reuse existing test cases with the same title from the default folder
		const ret: { id: string; seq: number }[] = []
		const idxToFill: number[] = []
		const finalTCasesToCreate: string[] = []
		for (let i = 0; i < tcasesToCreate.length; i++) {
			const existingTcase = apiTCasesMap[tcasesToCreate[i]]
			if (existingTcase) {
				// TCase with this title already exists, reuse it
				ret.push({ id: existingTcase.id, seq: existingTcase.seq })
				continue
			}

			// Add a placeholder for the new test case. Will be updated later
			ret.push({ id: '', seq: 0 })
			finalTCasesToCreate.push(tcasesToCreate[i])
			idxToFill.push(i)
		}

		if (!finalTCasesToCreate.length) {
			console.log(
				chalk.blue(
					`Reusing ${ret.length} test cases with same title from "${DEFAULT_FOLDER_TITLE}" folder, no new test cases created`
				)
			)
			return ret
		}

		// Create new test cases and update the placeholders with the actual test case IDs
		const { tcases } = await this.api.testcases.createTCases(projectCode, {
			folderPath: [DEFAULT_FOLDER_TITLE],
			tcases: finalTCasesToCreate.map((title) => ({ title, tags: DEFAULT_TCASE_TAGS })),
		})

		console.log(
			chalk.green(
				`Created ${tcases.length} new test cases in folder "${DEFAULT_FOLDER_TITLE}"${
					ret.length > tcases.length
						? ` and reused ${ret.length - tcases.length} test cases with same title`
						: ''
				}`
			)
		)

		for (let i = 0; i < idxToFill.length; i++) {
			ret[idxToFill[i]] = tcases[i]
		}

		try {
			const mappingFilename = processTemplate(DEFAULT_MAPPING_FILENAME_TEMPLATE)
			const mappingLines = tcases
				.map((t, i) => `${getTCaseMarker(projectCode, t.seq)}: ${tcasesToCreate[i]}`)
				.join('\n')

			writeFileSync(mappingFilename, mappingLines)
			console.log(
				chalk.yellow(
					`Created mapping file for newly created test cases: ${mappingFilename}\nUpdate your test cases to include the test case markers in the name, for future uploads`
				)
			)
		} catch (err) {
			console.log(
				chalk.yellow(
					`Warning: Failed to write test case mapping file: ${
						err instanceof Error ? err.message : String(err)
					}`
				)
			)
		}

		return ret
	}

	private async createNewRun(projectCode: string, tcaseIds: string[]) {
		const title = processTemplate(
			'runName' in this.args && this.args.runName
				? (this.args.runName as string)
				: 'Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}'
		)

		console.log(chalk.blue(`Creating a new test run for project: ${projectCode}`))

		try {
			const response = await this.api.runs.createRun(projectCode, {
				title,
				description: 'Test run created through automation pipeline',
				type: 'static_struct',
				queryPlans: [{ tcaseIds }],
			})

			console.log(chalk.green(`Created new test run "${title}" with ID: ${response.id}`))
			console.log(
				chalk.blue(`Test run URL: ${this.baseUrl}/project/${projectCode}/run/${response.id}`)
			)
			return response.id
		} catch (error) {
			// Check if the error is about conflicting run ID
			const errorMessage = error instanceof Error ? error.message : String(error)
			const conflictMatch = errorMessage.match(/conflicting run id: (\d+)$/)

			if (conflictMatch) {
				const existingRunId = Number(conflictMatch[1])
				console.log(chalk.yellow(`Reusing existing test run "${title}" with ID: ${existingRunId}`))
				return existingRunId
			}

			// If it's not a conflicting run ID error, re-throw the original error
			throw error
		}
	}

	private async uploadResults(projectCode: string, runId: number, results: TestCaseResult[]) {
		const runUrl = `${this.baseUrl}/project/${projectCode}/run/${runId}`
		const uploader = new ResultUploader(this.type, { ...this.args, runUrl })
		await uploader.handle(results)
	}
}
