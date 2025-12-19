import { Arguments } from 'yargs'
import chalk from 'chalk'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseRunUrl, printErrorThenExit, processTemplate } from '../misc'
import { Api, createApi } from '../../api'
import { TCase } from '../../api/schemas'
import { TestCaseResult } from './types'
import { ResultUploader } from './ResultUploader'
import { parseJUnitXml } from './junitXmlParser'
import { parsePlaywrightJson } from './playwrightJsonParser'
import { writeFileSync } from 'node:fs'

export type UploadCommandType = 'junit-upload' | 'playwright-json-upload'

export type SkipOutputOption = 'on-success' | 'never'

export interface ParserOptions {
	skipStdout: SkipOutputOption
	skipStderr: SkipOutputOption
}

export type Parser = (
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
			runName: string
			createTcases: boolean
	  }
)

interface FileResults {
	file: string
	results: TestCaseResult[]
}

const GET_TCASES_PAGE_SIZE = 5000
const DEFAULT_FOLDER_TITLE = 'cli-import'
const DEFAULT_TCASE_TAGS = ['cli-import']
const DEFAULT_MAPPING_FILENAME_TEMPLATE = 'qasphere-automapping-{YYYY}{MM}{DD}-{HH}{mm}{ss}.txt'
const commandTypeParsers: Record<UploadCommandType, Parser> = {
	'junit-upload': parseJUnitXml,
	'playwright-json-upload': parsePlaywrightJson,
}

export class ResultUploadCommandHandler {
	private api: Api
	private baseUrl: string

	constructor(private type: UploadCommandType, private args: Arguments<ResultUploadCommandArgs>) {
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

		if ('runUrl' in this.args) {
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
				projectCode = this.args.projectCode
			} else {
				// Try to auto-detect project code from results. This is not fully reliable, but
				// is kept for backward compatibility. Better to specify project code explicitly
				projectCode = this.detectProjectCode(fileResults)
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
			const fileData = readFileSync(file).toString()
			const fileResults = await commandTypeParsers[this.type](
				fileData,
				dirname(file),
				parserOptions
			)
			results.push({ file, results: fileResults })
		}

		return results
	}

	protected detectProjectCode(fileResults: FileResults[]) {
		for (const { results } of fileResults) {
			for (const result of results) {
				if (result.name) {
					// Look for pattern like PRJ-123 or TEST-456
					const match = result.name.match(/([A-Za-z0-9]{1,5})-\d{3,}/)
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

	protected async getTCaseIds(projectCode: string, fileResults: FileResults[]) {
		const shouldFailOnInvalid = !this.args.force && !this.args.ignoreUnmatched
		const tcaseMapBySeq: Record<number, TCase> = {}
		const tcaseMapByTitle: Record<string, TCase> = {}

		for (let page = 1; ; page++) {
			const response = await this.api.testcases.getTCasesPaginated(projectCode, {
				page,
				limit: GET_TCASES_PAGE_SIZE,
			})

			for (const tcase of response.data) {
				tcaseMapBySeq[tcase.seq] = tcase
				tcaseMapByTitle[tcase.title] = tcase // If there are multiple tcases with the same title, it will be overwritten
			}

			if (response.data.length < GET_TCASES_PAGE_SIZE) {
				break
			}
		}

		const tcaseIds: string[] = []
		const tcasesToCreate: Map<string, TestCaseResult[]> = new Map()
		for (const { file, results } of fileResults) {
			for (const result of results) {
				if (!result.name) {
					if (shouldFailOnInvalid) {
						return printErrorThenExit(`Test case in ${file} has no name`)
					}
					continue
				}

				const match = new RegExp(`${projectCode}-(\\d{3,})`).exec(result.name)
				if (match) {
					const tcase = tcaseMapBySeq[Number(match[1])]
					if (tcase) {
						tcaseIds.push(tcase.id)
						continue
					}
				}

				const tcase = tcaseMapByTitle[result.name]
				if (tcase) {
					// Prefix the test case markers for use in ResultUploader
					result.name = `${projectCode}-${tcase.seq.toString().padStart(3, '0')}: ${result.name}`
					tcaseIds.push(tcase.id)
					continue
				}

				if (this.args.createTcases) {
					const tcaseResults = tcasesToCreate.get(result.name) || []
					tcaseResults.push(result)
					tcasesToCreate.set(result.name, tcaseResults)
					continue
				}

				if (shouldFailOnInvalid) {
					return printErrorThenExit(
						`Test case name "${result.name}" in ${file} does not contain valid sequence number with project code (e.g., ${projectCode}-123)`
					)
				}
			}
		}

		if (tcasesToCreate.size > 0) {
			const keys = Array.from(tcasesToCreate.keys())
			const newTcases = await this.createNewTCases(projectCode, keys)

			for (let i = 0; i < keys.length; i++) {
				const marker = `${projectCode}-${newTcases[i].seq.toString().padStart(3, '0')}`
				for (const result of tcasesToCreate.get(keys[i]) || []) {
					// Prefix the test case markers for use in ResultUploader
					result.name = `${marker}: ${result.name}`
				}
				tcaseIds.push(newTcases[i].id)
			}
		}

		if (tcaseIds.length === 0) {
			return printErrorThenExit('No valid test cases found in any of the files')
		}

		return { tcaseIds, fileResults }
	}

	private async createNewTCases(projectCode: string, tcasesToCreate: string[]) {
		console.log(chalk.blue(`Creating new test cases for results with no test case markers`))

		const { tcases } = await this.api.testcases.createTCases(projectCode, {
			folderPath: [DEFAULT_FOLDER_TITLE],
			tcases: tcasesToCreate.map((title) => ({ title, tags: DEFAULT_TCASE_TAGS })),
		})

		console.log(
			chalk.green(`Created ${tcases.length} new test cases in folder "${DEFAULT_FOLDER_TITLE}"`)
		)

		try {
			const mappingFilename = processTemplate(DEFAULT_MAPPING_FILENAME_TEMPLATE)
			const mappingLines = tcases.map((t, i) => `${t.seq}: ${tcasesToCreate[i]}`).join('\n')
			writeFileSync(mappingFilename, mappingLines)
			console.log(
				chalk.green(`Created mapping file for newly created test cases: ${mappingFilename}`)
			)
			console.log(
				chalk.yellow(
					`Update your test cases to include the test case markers in the name, for future uploads`
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

		return tcases
	}

	private async createNewRun(projectCode: string, tcaseIds: string[]) {
		const title = processTemplate(
			'runName' in this.args
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
