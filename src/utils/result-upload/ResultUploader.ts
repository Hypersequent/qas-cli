import { Arguments } from 'yargs'
import chalk from 'chalk'
import { RunTCase } from '../../api/schemas'
import { parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { Attachment, TestCaseResult } from './types'
import { ResultUploadCommandArgs, UploadCommandType } from './ResultUploadCommandHandler'

const MAX_CONCURRENT_FILE_UPLOADS = 10
const MAX_RESULTS_IN_REQUEST = 50

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
		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
			console.error(
				`${header}${chalk.blue(`${folderMessage} "${item.name}"`)} does not match any test cases`
			)
		})

		if (missing.length) {
			if (this.type === 'junit-upload') {
				console.error(`
${chalk.yellow('To fix this issue, include the test case marker in your test names:')}

  Format: ${chalk.green(`${this.project}-<sequence>: Your test name`)}
  Example: ${chalk.green(`${this.project}-002: Login with valid credentials`)}
           ${chalk.green(`Login with invalid credentials: ${this.project}-1312`)}

  ${chalk.dim('Where <sequence> is the test case number (minimum 3 digits, zero-padded if needed)')}
`)
			} else {
				console.error(`
${chalk.yellow('To fix this issue, choose one of the following options:')}

  ${chalk.bold('Option 1: Use Test Annotations (Recommended)')}
  Add a test annotation to your Playwright test:

  ${chalk.green(`test('${missing[0]?.name || 'your test name'}', {
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

			console.error(chalk.yellow('Also ensure that the test cases exist in the QA Sphere project and the test run (if run URL is provided).'))
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
		try {
			const resultsWithAttachments = await this.uploadAllAttachments(results, loader)
			await this.createResultsInBatches(resultsWithAttachments, loader)
		} catch (e) {
			loader.stop()
			printErrorThenExit(e)
		}
	}

	private uploadAllAttachments = async (
		results: TCaseWithResult[],
		loader: ReturnType<typeof twirlLoader>
	): Promise<TCaseWithResult[]> => {
		if (!this.args.attachments) {
			return results
		}

		// Collect all attachments from all test cases
		const allAttachments: Array<{
			attachment: Attachment
			tcaseIndex: number
		}> = []
		let uploadedCount = 0

		results.forEach((item, index) => {
			item.result.attachments.forEach((attachment) => {
				if (attachment.buffer !== null) {
					allAttachments.push({ attachment, tcaseIndex: index })
				}
			})
		})

		if (allAttachments.length === 0) {
			return results
		}

		// Upload all attachments concurrently with progress tracking
		loader.start(`Uploading attachments: 0/${allAttachments.length} files uploaded`)
		const uploadedAttachments = await this.processConcurrently(
			allAttachments,
			async ({ attachment, tcaseIndex }) => {
				const { url } = await this.api.file.uploadFile(
					new Blob([attachment.buffer! as BlobPart]),
					attachment.filename
				)
				uploadedCount++
				loader.setText(
					`Uploading attachments: ${uploadedCount}/${allAttachments.length} files uploaded`
				)
				return {
					tcaseIndex,
					url,
					name: attachment.filename,
				}
			},
			MAX_CONCURRENT_FILE_UPLOADS
		)
		loader.stop()

		// Group uploaded attachments by test case index
		const attachmentsByTCase = new Map<number, Array<{ name: string; url: string }>>()
		uploadedAttachments.forEach(({ tcaseIndex, url, name }) => {
			if (!attachmentsByTCase.has(tcaseIndex)) {
				attachmentsByTCase.set(tcaseIndex, [])
			}
			attachmentsByTCase.get(tcaseIndex)!.push({ url, name })
		})

		// Map results with their uploaded attachment URLs
		return results.map(({ tcase, result }, index) => {
			const attachmentUrls = attachmentsByTCase.get(index) || []
			if (attachmentUrls.length > 0) {
				result.message += `\n<h4>Attachments:</h4>\n${makeListHtml(attachmentUrls)}`
			}

			return {
				tcase,
				result,
			}
		})
	}

	private createResultsInBatches = async (
		results: TCaseWithResult[],
		loader: ReturnType<typeof twirlLoader>
	) => {
		const totalBatches = Math.ceil(results.length / MAX_RESULTS_IN_REQUEST)

		loader.start(`Creating results: 0/${results.length} results created`)
		for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
			const startIdx = batchIndex * MAX_RESULTS_IN_REQUEST
			const endIdx = Math.min(startIdx + MAX_RESULTS_IN_REQUEST, results.length)
			const batch = results.slice(startIdx, endIdx)

			await this.api.runs.createResults(this.project, this.run, {
				items: batch.map(({ tcase, result }) => ({
					tcaseId: tcase.id,
					status: result.status,
					comment: result.message,
				})),
			})

			loader.setText(`Creating results: ${endIdx}/${results.length} results created`)
		}
		loader.stop()
	}

	private async processConcurrently<T, R>(
		items: T[],
		handler: (item: T) => Promise<R>,
		concurrency: number
	): Promise<R[]> {
		const results: R[] = []
		const executing: Set<Promise<void>> = new Set()

		for (const item of items) {
			const promise = handler(item)
				.then((result) => {
					results.push(result)
				})
				.finally(() => {
					executing.delete(wrappedPromise)
				})

			const wrappedPromise = promise
			executing.add(wrappedPromise)

			if (executing.size >= concurrency) {
				await Promise.race(executing)
			}
		}

		await Promise.all(Array.from(executing))
		return results
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
