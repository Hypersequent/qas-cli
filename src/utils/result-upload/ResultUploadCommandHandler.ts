import { Arguments } from 'yargs'
import chalk from 'chalk'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseRunUrl, printErrorThenExit, processTemplate } from '../misc'
import { MarkerParser } from './MarkerParser'
import { Api, createApi } from '../../api'
import { TCase } from '../../api/tcases'
import { ParseResult, TestCaseMarker, TestCaseResult } from './types'
import { DuplicateTCaseMapping, TCaseTarget, mapResolvedResultsToTCases } from './mapping'
import { ResultUploader } from './ResultUploader'
import { parseJUnitXml } from './parsers/junitXmlParser'
import { parsePlaywrightJson } from './parsers/playwrightJsonParser'
import { parseAllureResults } from './parsers/allureParser'

export type UploadCommandType = 'junit-upload' | 'playwright-json-upload' | 'allure-upload'

export type SkipOutputOption = 'on-success' | 'never'

export interface ParserOptions {
	skipStdout: SkipOutputOption
	skipStderr: SkipOutputOption
	allowPartialParse?: boolean
}

export type Parser = (
	// Primary parser input. File-based parsers receive file contents while
	// directory-based parsers (like Allure) receive a directory path.
	data: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
) => Promise<ParseResult>

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
	runFailureLogs: string
}

interface TestCaseResultWithSeqAndFile {
	seq: number | null
	file: string
	result: TestCaseResult
}

type PendingTCaseCreations = Record<string, TestCaseResult[]>

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
	private markerParser: MarkerParser
	private skipUploaderDuplicateValidation = false

	constructor(
		private type: UploadCommandType,
		private args: Arguments<ResultUploadCommandArgs>
	) {
		const apiToken = process.env.QAS_TOKEN!

		this.baseUrl = process.env.QAS_URL!.replace(/\/+$/, '')
		this.api = createApi(this.baseUrl, apiToken)
		this.markerParser = new MarkerParser(this.type)
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
			this.resolveMarkers(fileResults, projectCode)
		} else {
			if (this.args.projectCode) {
				projectCode = this.args.projectCode as string
			} else {
				// Try to auto-detect project code from results. This is not fully reliable, but
				// is kept for backward compatibility. Better to specify project code explicitly
				projectCode = this.detectProjectCodeFromTCaseNames(fileResults)
				console.log(chalk.blue(`Detected project code: ${projectCode}`))
			}

			if (!(await this.api.projects.checkExists(projectCode))) {
				return printErrorThenExit(`Project ${projectCode} does not exist`)
			}

			const resp = await this.getTCaseIds(projectCode, fileResults)
			fileResults = resp.fileResults
			this.resolveMarkers(fileResults, projectCode)
			this.validateDuplicateMappings(projectCode, fileResults, Object.values(resp.targetsBySeq))
			await this.finalizePendingTCases(
				projectCode,
				resp.pendingTCasesToCreate,
				resp.targetsBySeq,
				resp.tcaseIds
			)

			const createRunResult = await this.createNewRun(projectCode, resp.tcaseIds)
			runId = createRunResult.runId
			this.skipUploaderDuplicateValidation = !createRunResult.reusedExisting
		}

		const results = fileResults.flatMap((fileResult) => fileResult.results)
		const runFailureLogs = fileResults.map((fr) => fr.runFailureLogs).join('')
		await this.uploadResults({ projectCode, runId, results, runFailureLogs })
	}

	protected async parseFiles(): Promise<FileResults[]> {
		const results: FileResults[] = []

		const parserOptions: ParserOptions = {
			skipStdout: this.args.skipReportStdout,
			skipStderr: this.args.skipReportStderr,
			allowPartialParse: this.args.force,
		}

		for (const file of this.args.files) {
			const isDirectoryInput = directoryInputTypes.has(this.type)
			const fileData = isDirectoryInput ? file : readFileSync(file).toString()
			const attachmentBaseDir = isDirectoryInput ? file : dirname(file)
			const parseResult = await commandTypeParsers[this.type](
				fileData,
				attachmentBaseDir,
				parserOptions
			)
			results.push({
				file,
				results: parseResult.testCaseResults,
				runFailureLogs: parseResult.runFailureLogs,
			})
		}

		return results
	}

	protected detectProjectCodeFromTCaseNames(fileResults: FileResults[]) {
		for (const { results } of fileResults) {
			for (const result of results) {
				if (result.markerResolution === 'resolved' && result.marker?.projectCode) {
					return result.marker.projectCode
				}
				if (result.markerResolution !== 'resolved-none' && result.name) {
					const code = this.markerParser.detectProjectCode(result.name)
					if (code) return code
				}
			}
		}

		return printErrorThenExit(
			'Could not detect project code from test case names. Please specify project code using --project-code flag'
		)
	}

	protected async getTCaseIds(projectCode: string, fileResults: FileResults[]) {
		const shouldFailOnInvalid = !this.args.force && !this.args.ignoreUnmatched

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

				const marker = this.resolveMarker(result, projectCode)
				const seq = marker?.seq ?? null
				resultsWithSeqAndFile.push({
					seq,
					file,
					result,
				})

				if (seq !== null) {
					seqIdsSet.add(seq)
				}
			}
		}

		// Now fetch the test cases by their sequence numbers
		const apiTCasesMap: Record<number, TCaseTarget> = {}
		if (seqIdsSet.size > 0) {
			const tcaseMarkers = Array.from(seqIdsSet).map((v) =>
				this.markerParser.formatMarker(projectCode, v)
			)

			for (let page = 1; ; page++) {
				const response = await this.api.testCases.getBySeq(projectCode, {
					seqIds: tcaseMarkers,
					page,
					limit: DEFAULT_PAGE_SIZE,
				})

				for (const tcase of response.data) {
					apiTCasesMap[tcase.seq] = {
						id: tcase.id,
						seq: tcase.seq,
						title: tcase.title,
					}
				}

				if (response.data.length < DEFAULT_PAGE_SIZE) {
					break
				}
			}
		}

		// Now validate that the test cases with found sequence numbers actually exist
		const tcaseIds: string[] = []
		const tcasesToCreateMap: PendingTCaseCreations = {}
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

		const pendingTCasesToCreate = await this.planPendingTCasesToCreate(
			projectCode,
			tcasesToCreateMap,
			apiTCasesMap,
			tcaseIds
		)

		if (
			tcaseIds.length === 0 &&
			Object.keys(pendingTCasesToCreate).length === 0 &&
			!fileResults.some((fr) => fr.runFailureLogs)
		) {
			return printErrorThenExit('No valid test cases found in any of the files')
		}

		return { tcaseIds, fileResults, targetsBySeq: apiTCasesMap, pendingTCasesToCreate }
	}

	private async planPendingTCasesToCreate(
		projectCode: string,
		tcasesToCreateMap: PendingTCaseCreations,
		apiTCasesMap: Record<number, TCaseTarget>,
		tcaseIds: string[]
	) {
		if (Object.keys(tcasesToCreateMap).length === 0) {
			return {}
		}

		const reusableTCases = await this.getReusableTCasesInDefaultFolder(
			projectCode,
			Object.keys(tcasesToCreateMap)
		)
		const pendingTCasesToCreate: PendingTCaseCreations = {}

		for (const [title, results] of Object.entries(tcasesToCreateMap)) {
			const reusableTCase = reusableTCases[title]
			if (!reusableTCase) {
				pendingTCasesToCreate[title] = results
				continue
			}

			this.assignResolvedTarget(projectCode, reusableTCase, results)
			apiTCasesMap[reusableTCase.seq] = {
				id: reusableTCase.id,
				seq: reusableTCase.seq,
				title,
			}
			tcaseIds.push(reusableTCase.id)
		}

		return pendingTCasesToCreate
	}

	private async finalizePendingTCases(
		projectCode: string,
		pendingTCasesToCreate: PendingTCaseCreations,
		apiTCasesMap: Record<number, TCaseTarget>,
		tcaseIds: string[]
	) {
		const titles = Object.keys(pendingTCasesToCreate)
		if (titles.length === 0) {
			return
		}

		const newTCases = await this.createNewTCases(projectCode, titles)
		for (let i = 0; i < titles.length; i++) {
			const title = titles[i]
			const newTCase = newTCases[i]
			this.assignResolvedTarget(projectCode, newTCase, pendingTCasesToCreate[title] || [])
			apiTCasesMap[newTCase.seq] = {
				id: newTCase.id,
				seq: newTCase.seq,
				title,
			}
			tcaseIds.push(newTCase.id)
		}
	}

	private assignResolvedTarget(
		projectCode: string,
		tcase: { id: string; seq: number },
		results: TestCaseResult[]
	) {
		const marker = this.markerParser.formatMarker(projectCode, tcase.seq)
		const duplicateTargetAllowed = results.length > 1
		for (const result of results) {
			// Prefix the test case markers for use in ResultUploader. The fileResults array
			// containing the updated name is returned to the caller
			result.name = `${marker}: ${result.name}`
			result.marker = {
				projectCode,
				seq: tcase.seq,
			}
			result.markerResolution = 'resolved'
			result.allowDuplicateTarget = duplicateTargetAllowed
		}
	}

	private async getReusableTCasesInDefaultFolder(projectCode: string, tcasesToCreate: string[]) {
		// First fetch the default folder ID where we are creating new test cases.
		// Ideally, there shouldn't be the need to fetch more than one page.
		let defaultFolderId = null
		for (let page = 1; ; page++) {
			const response = await this.api.folders.getPaginated(projectCode, {
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

		const reusableTCases: Record<string, TCase> = {}
		if (!defaultFolderId) {
			return reusableTCases
		}

		const pendingTitles = new Set(tcasesToCreate)
		for (let page = 1; pendingTitles.size > 0; page++) {
			const response = await this.api.testCases.getPaginated(projectCode, {
				folders: [defaultFolderId],
				page,
				limit: DEFAULT_PAGE_SIZE,
			})

			for (const tcase of response.data) {
				if (!pendingTitles.has(tcase.title)) {
					continue
				}
				reusableTCases[tcase.title] = tcase
				pendingTitles.delete(tcase.title)
			}

			if (response.data.length < DEFAULT_PAGE_SIZE) {
				break
			}
		}

		return reusableTCases
	}

	private async createNewTCases(projectCode: string, tcasesToCreate: string[]) {
		console.log(chalk.blue(`Creating test cases for results with no test case markers`))

		const apiTCasesMap = await this.getReusableTCasesInDefaultFolder(projectCode, tcasesToCreate)

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
		const { tcases } = await this.api.testCases.createBatch(projectCode, {
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
				.map(
					(t, i) => `${this.markerParser.formatMarker(projectCode, t.seq)}: ${tcasesToCreate[i]}`
				)
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
			const response = await this.api.runs.create(projectCode, {
				title,
				description: 'Test run created through automation pipeline',
				type: 'static_struct',
				queryPlans: [{ tcaseIds }],
			})

			console.log(chalk.green(`Created new test run "${title}" with ID: ${response.id}`))
			console.log(
				chalk.blue(`Test run URL: ${this.baseUrl}/project/${projectCode}/run/${response.id}`)
			)
			return { runId: response.id, reusedExisting: false }
		} catch (error) {
			// Check if the error is about conflicting run ID
			const errorMessage = error instanceof Error ? error.message : String(error)
			const conflictMatch = errorMessage.match(/conflicting run id: (\d+)$/)

			if (conflictMatch) {
				const existingRunId = Number(conflictMatch[1])
				console.log(chalk.yellow(`Reusing existing test run "${title}" with ID: ${existingRunId}`))
				return { runId: existingRunId, reusedExisting: true }
			}

			// If it's not a conflicting run ID error, re-throw the original error
			throw error
		}
	}

	private async uploadResults({
		projectCode,
		runId,
		results,
		runFailureLogs,
	}: {
		projectCode: string
		runId: number
		results: TestCaseResult[]
		runFailureLogs: string
	}) {
		const runUrl = `${this.baseUrl}/project/${projectCode}/run/${runId}`
		const uploader = new ResultUploader(
			this.type,
			{ ...this.args, runUrl },
			{ skipDuplicateValidation: this.skipUploaderDuplicateValidation }
		)
		await uploader.handle(results, runFailureLogs)
	}

	private resolveMarkers(fileResults: FileResults[], projectCode: string) {
		for (const { results } of fileResults) {
			for (const result of results) {
				this.resolveMarker(result, projectCode)
			}
		}
	}

	private validateDuplicateMappings(
		projectCode: string,
		fileResults: FileResults[],
		targets: TCaseTarget[]
	) {
		const { duplicates } = mapResolvedResultsToTCases(
			projectCode,
			fileResults.flatMap((fileResult) => fileResult.results),
			targets
		)

		if (!duplicates.length) {
			return
		}

		this.printDuplicateMappings(projectCode, duplicates)
		if (!this.args.force) {
			process.exit(1)
		}
	}

	private resolveMarker(result: TestCaseResult, projectCode: string): TestCaseMarker | null {
		if (result.markerResolution === 'resolved' && result.marker) {
			return result.marker.projectCode.toLowerCase() === projectCode.toLowerCase()
				? result.marker
				: null
		}

		if (result.markerResolution === 'resolved-none') {
			return null
		}

		if (!result.name) {
			result.markerResolution = 'resolved-none'
			return null
		}

		const seq = this.markerParser.extractSeq(result.name, projectCode)
		if (seq === null) {
			result.markerResolution = 'resolved-none'
			return null
		}

		result.marker = {
			projectCode: this.markerParser.detectProjectCode(result.name) || projectCode,
			seq,
		}
		result.markerResolution = 'resolved'
		return result.marker
	}

	private printDuplicateMappings(projectCode: string, duplicates: DuplicateTCaseMapping[]) {
		const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
		for (const duplicate of duplicates) {
			console.error(
				`${header} multiple results map to ${chalk.green(`${projectCode}-${duplicate.tcase.seq}`)} (${chalk.blue(duplicate.tcase.title)}):`
			)
			for (const result of duplicate.results) {
				const folderMessage = result.folder ? ` "${result.folder}" ->` : ''
				console.error(`  -${folderMessage} "${result.name}"`)
			}
		}
	}
}
