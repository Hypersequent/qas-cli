import { Arguments } from 'yargs'
import chalk from 'chalk'
import { RunTCase } from '../../api/schemas'
import { parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { TestCaseResult } from './types'
import { ResultUploadCommandArgs } from './ResultUploadCommandHandler'

export class ResultUploader {
	private api: Api
	private project: string
	private run: number

	constructor(private args: Arguments<ResultUploadCommandArgs>) {
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
		await this.uploadTestCases(mappedResults)

		console.log(`Uploaded ${mappedResults.length} test cases`)
	}

	private validateAndPrintMissingTestCases(missing: TestCaseResult[]) {
		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
			console.error(
				`${header}${chalk.blue(`${folderMessage} "${item.name}"`)} does not match any test cases`
			)
		})

		if (missing.length) {
			console.error(
				chalk.yellow(
					'\nTo fix this issue, please rename your test cases in the report file to match the expected format:'
				)
			)
			console.error(
				`  Expected format: ${chalk.green(`${this.project}-<sequence>: Your test name`)}`
			)
			console.error(
				`  Where <sequence> is the test case sequence number (can be 3 or more digits).`
			)
			console.error(
				`  Example: ${chalk.green(`${this.project}-1024: Login with valid credentials`)}\n`
			)
			console.error(chalk.yellow('Also ensure that the test cases are part of the run.\n'))
		}

		if (missing.length && !this.args.force) {
			process.exit(1)
		}
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
					comment += `\n<h4>Attachments:</h4>\n${makeListHtml(attachmentUrls)}`
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
