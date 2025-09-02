import { Arguments } from 'yargs'
import { JUnitArgs } from '../../commands/junit-upload'
import { parseJUnitXml } from './junitXmlParser'
import chalk from 'chalk'
import { parseRunUrl, printErrorThenExit, processTemplate } from '../misc'
import { Api, createApi } from '../../api'
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { JUnitCommandHandler } from './JUnitCommandHandler'
import { extractProjectCode } from '../projectExtractor'
import { CreateRunResponse } from '../../api/run'
import { PaginatedResponse, TCaseBySeq } from '../../api/tcases'

export class JUnitResultUploader {
	private api: Api
	private apiToken: string
	private baseUrl: string
	private project: string
	private run?: number

	constructor(private args: Arguments<JUnitArgs>) {
		// Get required environment variables
		this.apiToken = process.env.QAS_TOKEN!
		this.baseUrl = process.env.QAS_URL!

		if (args.runUrl) {
			// Handle existing run URL
			const { url, project, run } = parseRunUrl(args)
			this.baseUrl = url
			this.project = project
			this.run = run
		} else {
			// Auto-detect project from XML files
			this.project = extractProjectCode(args.files)
			console.log(chalk.blue(`Detected project code: ${this.project}`))
		}

		this.api = createApi(this.baseUrl, this.apiToken)
	}

	async handle() {
		if (!this.args.files || this.args.files.length === 0) {
			return printErrorThenExit('No files specified')
		}

		if (this.run) {
			// Handle existing test run
			console.log(chalk.blue(`Using existing test run: ${this.args.runUrl}`))
			const handler = new JUnitCommandHandler({
				...this.args,
				token: this.apiToken,
			})
			await handler.handle()
			return
		}

		if (!(await this.api.projects.checkProjectExists(this.project))) {
			return printErrorThenExit(`Project ${this.project} does not exist`)
		}

		// Create a new test run
		console.log(chalk.blue(`Creating a new test run for project: ${this.project}`))
		const tcaseRefs = await this.extractTestCaseRefs()
		const tcases = await this.getTestCases(tcaseRefs)
		const runId = await this.createNewRun(tcases)
		await this.uploadResults(runId)
	}

	private async extractTestCaseRefs(): Promise<Set<string>> {
		const tcaseRefs = new Set<string>()

		for (const file of this.args.files) {
			const xmlContent = readFileSync(file).toString()
			const { testcases } = await parseJUnitXml(xmlContent, dirname(file))

			for (const testcase of testcases) {
				if (!testcase.name) {
					if (!this.args.force) {
						return printErrorThenExit(`Test case in ${file} has no name`)
					}
					continue
				}
				const match = /(\d{3,})/.exec(testcase.name)
				if (match) {
					tcaseRefs.add(`${this.project}-${match[1]}`)
				} else if (!this.args.force) {
					return printErrorThenExit(
						`Test case name "${testcase.name}" in ${file} does not contain valid sequence number (e.g., 123)`
					)
				}
			}
		}

		if (tcaseRefs.size === 0) {
			return printErrorThenExit('No valid test case references found in files')
		}

		return tcaseRefs
	}

	private async getTestCases(tcaseRefs: Set<string>) {
		const response = await this.api.testcases.getTCasesBySeq(this.project, {
			seqIds: Array.from(tcaseRefs),
			page: 1,
			limit: tcaseRefs.size,
		})

		if (response.total === 0 || response.data.length === 0) {
			return printErrorThenExit('No matching test cases found in the project')
		}

		return response
	}

	private async createNewRun(tcases: PaginatedResponse<TCaseBySeq>) {
		const title = this.args.runName
			? processTemplate(this.args.runName)
			: processTemplate('Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}')

		const runId = await this.api.runs.createRun(this.project, {
			title,
			description: 'Test run created through automation pipeline',
			type: 'static_struct',
			queryPlans: [
				{
					tcaseIds: tcases.data.map((t: TCaseBySeq) => t.id),
				},
			],
		})

		console.log(chalk.green(`Created new test run with ID: ${runId.id}`))
		return runId
	}

	private async uploadResults(runId: CreateRunResponse) {
		const newRunUrl = `${this.baseUrl}/project/${this.project}/run/${runId.id}`
		const newHandler = new JUnitCommandHandler({
			...this.args,
			runUrl: newRunUrl,
			token: this.apiToken,
		})
		await newHandler.handle()
	}
}
