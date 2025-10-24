import { Arguments } from 'yargs'
import chalk from 'chalk'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { parseRunUrl, printErrorThenExit, processTemplate } from '../misc'
import { Api, createApi } from '../../api'
import { PaginatedResponse, TCaseBySeq } from '../../api/tcases'
import { TestCaseResult } from './types'
import { ResultUploader } from './ResultUploader'
import { parseJUnitXml } from './junitXmlParser'
import { parsePlaywrightJson } from './playwrightJsonParser'

export type UploadCommandType = 'junit-upload' | 'playwright-json-upload'

export type Parser = (data: string, attachmentBaseDirectory: string) => Promise<TestCaseResult[]>

export interface ResultUploadCommandArgs {
	type: UploadCommandType
	runUrl?: string
	runName?: string
	files: string[]
	force: boolean
	attachments: boolean
}

interface FileResults {
	file: string
	results: TestCaseResult[]
}

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

		const fileResults = await this.parseFiles()
		const results = fileResults.flatMap((fileResult) => fileResult.results)

		let projectCode = ''
		let runId = 0
		if (this.args.runUrl) {
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
			// Auto-detect project from results
			projectCode = this.detectProjectCode(results)
			console.log(chalk.blue(`Detected project code: ${projectCode}`))

			// Create a new test run
			if (!(await this.api.projects.checkProjectExists(projectCode))) {
				return printErrorThenExit(`Project ${projectCode} does not exist`)
			}

			console.log(chalk.blue(`Creating a new test run for project: ${projectCode}`))
			const tcaseRefs = this.extractTestCaseRefs(projectCode, fileResults)
			const tcases = await this.getTestCases(projectCode, tcaseRefs)
			runId = await this.createNewRun(projectCode, tcases)
			console.log(chalk.blue(`Test run URL: ${this.baseUrl}/project/${projectCode}/run/${runId}`))
		}

		await this.uploadResults(projectCode, runId, results)
	}

	protected async parseFiles(): Promise<FileResults[]> {
		const results: FileResults[] = []

		for (const file of this.args.files) {
			const fileData = readFileSync(file).toString()
			const fileResults = await commandTypeParsers[this.type](fileData, dirname(file))
			results.push({ file, results: fileResults })
		}

		return results
	}

	protected detectProjectCode(results: TestCaseResult[]) {
		for (const result of results) {
			if (result.name) {
				// Look for pattern like PRJ-123 or TEST-456
				const match = result.name.match(/([A-Za-z0-9]{1,5})-\d{3,}/)
				if (match) {
					return match[1]
				}
			}
		}

		return printErrorThenExit(
			'Could not detect project code from test case names. Please make sure they contain a valid project code (e.g., PRJ-123)'
		)
	}

	protected extractTestCaseRefs(projectCode: string, fileResults: FileResults[]): Set<string> {
		const tcaseRefs = new Set<string>()

		for (const { file, results } of fileResults) {
			for (const result of results) {
				if (!result.name) {
					if (!this.args.force) {
						return printErrorThenExit(`Test case in ${file} has no name`)
					}
					continue
				}

				const match = /(\d{3,})/.exec(result.name)
				if (match) {
					tcaseRefs.add(`${projectCode}-${match[1]}`)
				} else if (!this.args.force) {
					return printErrorThenExit(
						`Test case name "${result.name}" in ${file} does not contain valid sequence number (e.g., 123)`
					)
				}
			}
		}

		if (tcaseRefs.size === 0) {
			return printErrorThenExit('No valid test case references found in any of the files')
		}

		return tcaseRefs
	}

	private async getTestCases(projectCode: string, tcaseRefs: Set<string>) {
		const response = await this.api.testcases.getTCasesBySeq(projectCode, {
			seqIds: Array.from(tcaseRefs),
			page: 1,
			limit: tcaseRefs.size,
		})

		if (response.total === 0 || response.data.length === 0) {
			return printErrorThenExit('No matching test cases found in the project')
		}

		return response
	}

	private async createNewRun(projectCode: string, tcases: PaginatedResponse<TCaseBySeq>) {
		const title = processTemplate(
			this.args.runName ?? 'Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}'
		)

		try {
			const response = await this.api.runs.createRun(projectCode, {
				title,
				description: 'Test run created through automation pipeline',
				type: 'static_struct',
				queryPlans: [
					{
						tcaseIds: tcases.data.map((t: TCaseBySeq) => t.id),
					},
				],
			})

			console.log(chalk.green(`Created new test run "${title}" with ID: ${response.id}`))
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
