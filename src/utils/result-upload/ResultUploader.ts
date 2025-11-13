import { Arguments } from 'yargs'
import chalk from 'chalk'
import { RunTCase } from '../../api/schemas'
import { parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { TestCaseResult } from './types'
import { ResultUploadCommandArgs, UploadCommandType } from './ResultUploadCommandHandler'

export class ResultUploader {
	private api: Api
	private project: string
	private run: number

	constructor(private type: UploadCommandType, private args: Arguments<ResultUploadCommandArgs>) {
		const apiToken = process.env.QAS_TOKEN!
		const { url, project, run } = parseRunUrl(args)

		this.project = project
		this.run = run
		this.api = createApi(url, apiToken)
	}

	async handle(results: TestCaseResult[]) {
		const tcases = await this.api.runs
			.getRunTCases(this.project, this.run)
			.catch(printErrorThenExit)

		const { results: mappedResults, missing } = this.mapTestCaseResults(results, tcases)
		this.validateAndPrintMissingTestCases(missing)
		this.validateAndPrintMissingAttachments(mappedResults)

		console.log(
			`Uploading files [${this.args.files
				.map((f) => chalk.green(f))
				.join(', ')}] to run [${chalk.green(this.run)}] of project [${chalk.green(this.project)}]`
		)
		await this.uploadTestCases(mappedResults)
		console.log(`Uploaded ${mappedResults.length} test cases`)
	}

	private validateAndPrintMissingTestCases(missing: TestCaseResult[]) {
		if (!missing.length) {
			return
		}

		if (this.args.ignoreUnmatched) {
			this.printMissingTestCaseSummary(missing.length)
			return
		}

		this.printMissingTestCaseErrors(missing)
		this.printMissingTestCaseGuidance(missing)

		if (!this.args.force) {
			process.exit(1)
		}
	}

	private printMissingTestCaseErrors(missing: TestCaseResult[]) {
		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
			console.error(
				`${header}${chalk.blue(`${folderMessage} "${item.name}"`)} does not match any test cases`
			)
		})
	}

	private printMissingTestCaseSummary(count: number) {
		console.log(chalk.dim(`\nSkipped ${count} unmatched test${count === 1 ? '' : 's'}`))
	}

	private printMissingTestCaseGuidance(missing: TestCaseResult[]) {
		if (this.type === 'junit-upload') {
			this.printJUnitGuidance()
		} else if (this.type === 'playwright-json-upload') {
			this.printPlaywrightGuidance(missing[0]?.name || 'your test name')
		}
		console.error(chalk.yellow('Also ensure that the test cases exist in the QA Sphere project and the test run (if run URL is provided).'))
	}

	private printJUnitGuidance() {
		console.error(`
${chalk.yellow('To fix this issue, include the test case marker in your test names:')}

  Format: ${chalk.green(`${this.project}-<sequence>: Your test name`)}
  Example: ${chalk.green(`${this.project}-002: Login with valid credentials`)}
           ${chalk.green(`Login with invalid credentials: ${this.project}-1312`)}

  ${chalk.dim('Where <sequence> is the test case number (minimum 3 digits, zero-padded if needed)')}
`)
	}

	private printPlaywrightGuidance(exampleTestName: string) {
		console.error(`
${chalk.yellow('To fix this issue, choose one of the following options:')}

  ${chalk.bold('Option 1: Use Test Annotations (Recommended)')}
  Add a test annotation to your Playwright test:

  ${chalk.green(`test('${exampleTestName}', {
    annotation: {
      type: 'test case',
      description: 'https://your-qas-instance.com/project/${this.project}/tcase/123'
    }
  }, async ({ page }) => {
    // your test code
  });`)}

  ${chalk.dim('Note: The "type" field is case-insensitive')}

  ${chalk.bold('Option 2: Include Test Case Marker in Name')}
  Rename your test to include the marker ${chalk.green(`${this.project}-<sequence>`)}:

  Format: ${chalk.green(`${this.project}-<sequence>: Your test name`)}
  Example: ${chalk.green(`${this.project}-1024: Login with valid credentials`)}
  ${chalk.dim('Where <sequence> is the test case number (minimum 3 digits, zero-padded if needed)')}
`)
	}

	private validateAndPrintMissingAttachments = (results: TCaseWithResult[]) => {
		if (this.args.attachments) {
			let hasAttachmentErrors = false
			results.forEach(({ result }) => {
				result.attachments.forEach((attachment) => {
					if (attachment.error) {
						printError(attachment.error)
						hasAttachmentErrors = true
					}
				})
			})
			if (hasAttachmentErrors && !this.args.force) {
				process.exit(1)
			}
		}
	}

	private uploadTestCases = async (results: TCaseWithResult[]) => {
		const loader = twirlLoader()
		loader.start()
		try {
			for (let i = 0; i < results.length; i++) {
				const { tcase, result } = results[i]
				let comment = result.message
				loader.setText(`Uploading test case ${i + 1} of ${results.length}`)
				if (this.args.attachments) {
					const attachmentUrls: Array<{ name: string; url: string }> = []
					for (const attachment of result.attachments) {
						if (attachment.buffer) {
							const { url } = await this.api.file.uploadFile(
								new Blob([attachment.buffer]),
								attachment.filename
							)
							attachmentUrls.push({ url, name: attachment.filename })
						}
					}
					if (attachmentUrls.length > 0) {
						comment += `\n<h4>Attachments:</h4>\n${makeListHtml(attachmentUrls)}`
					}
				}

				await this.api.runs.createResultStatus(this.project, this.run, tcase.id, {
					status: result.status,
					comment,
				})
			}
			loader.stop()
		} catch (e) {
			loader.stop()
			printErrorThenExit(e)
		}
	}

	private mapTestCaseResults = (testcaseResults: TestCaseResult[], testcases: RunTCase[]) => {
		const results: TCaseWithResult[] = []
		const missing: TestCaseResult[] = []

		testcaseResults.forEach((result) => {
			if (result.name) {
				const tcase = testcases.find((tcase) => {
					const tcaseCode = `${this.project}-${tcase.seq.toString().padStart(3, '0')}`
					return result.name.includes(tcaseCode)
				})

				if (tcase) {
					results.push({ result, tcase })
					return
				}
			}
			missing.push(result)
		})

		return { results, missing }
	}
}

interface TCaseWithResult {
	tcase: RunTCase
	result: TestCaseResult
}

const makeListHtml = (list: { name: string; url: string }[]) => {
	return `<ul>
${list.map((item) => `<li><a href="${item.url}">${item.name}</a></li>`).join('\n')}
</ul>`
}
