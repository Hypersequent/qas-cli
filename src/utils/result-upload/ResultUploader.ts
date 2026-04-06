import { Arguments } from 'yargs'
import chalk from 'chalk'
import escapeHtml from 'escape-html'
import { RunTCase } from '../../api/runs'
import { parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { Attachment, TestCaseResult } from './types'
import { ResultUploadCommandArgs, UploadCommandType } from './ResultUploadCommandHandler'
import { DuplicateTCaseMapping, TCaseWithResult, mapResolvedResultsToTCases } from './mapping'

const MAX_CONCURRENT_BATCH_UPLOADS = 3
const MAX_BATCH_SIZE_BYTES = 100 * 1024 * 1024 // 100 MiB
const MAX_BATCH_FILE_COUNT = 100
let MAX_RESULTS_IN_REQUEST = 500 // Only updated from tests, otherwise it's a constant

export class ResultUploader {
	private api: Api
	private project: string
	private run: number

	constructor(
		private type: UploadCommandType,
		private args: Arguments<ResultUploadCommandArgs>,
		private options: { skipDuplicateValidation?: boolean } = {}
	) {
		const apiToken = process.env.QAS_TOKEN!
		const { url, project, run } = parseRunUrl(args)

		this.project = project
		this.run = run
		this.api = createApi(url, apiToken)
	}

	async handle(results: TestCaseResult[], runFailureLogs?: string) {
		const tcases = await this.api.runs.getTCases(this.project, this.run).catch(printErrorThenExit)

		const { results: mappedResults, missing, duplicates } = this.mapTestCaseResults(results, tcases)
		this.validateAndPrintMissingTestCases(missing)
		if (!this.options.skipDuplicateValidation) {
			this.validateAndPrintDuplicateMappings(duplicates)
		}
		this.validateAndPrintMissingAttachments(mappedResults)

		console.log(
			`Uploading files [${this.args.files
				.map((f) => chalk.green(f))
				.join(', ')}] to run [${chalk.green(this.run)}] of project [${chalk.green(this.project)}]`
		)

		if (runFailureLogs) {
			await this.api.runs.createLog(this.project, this.run, { comment: runFailureLogs })
			console.log(`Uploaded run failure logs`)
		}

		if (mappedResults.length) {
			await this.uploadTestCases(mappedResults)
			const uniqueTCases = new Set(mappedResults.map((r) => r.tcase.id)).size
			console.log(`Uploaded ${mappedResults.length} results to ${uniqueTCases} test cases`)
		}
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

	private validateAndPrintDuplicateMappings(duplicates: DuplicateTCaseMapping[]) {
		if (!duplicates.length) {
			return
		}

		const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
		for (const duplicate of duplicates) {
			console.error(
				`${header} multiple results map to ${chalk.green(`${this.project}-${duplicate.tcase.seq}`)} (${chalk.blue(duplicate.tcase.title)}):`
			)
			for (const result of duplicate.results) {
				const folderMessage = result.folder ? ` "${result.folder}" ->` : ''
				console.error(`  -${folderMessage} "${result.name}"`)
			}
		}

		if (!this.args.force) {
			process.exit(1)
		}
	}

	private printMissingTestCaseGuidance(missing: TestCaseResult[]) {
		if (this.type === 'junit-upload') {
			this.printJUnitGuidance()
		} else if (this.type === 'playwright-json-upload') {
			this.printPlaywrightGuidance(missing[0]?.name || 'your test name')
		} else if (this.type === 'allure-upload') {
			this.printAllureGuidance(missing[0]?.name || 'your test name')
		}
		console.error(
			chalk.yellow(
				'Also ensure that the test cases exist in the QA Sphere project and the test run (if run URL is provided).'
			)
		)
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

	private printAllureGuidance(exampleTestName: string) {
		console.error(`
${chalk.yellow('To fix this issue, choose one of the following options:')}

  ${chalk.bold('Option 1: Add a TMS Link (Recommended)')}
  Add a TMS link in the Allure result with:
    - ${chalk.green('type')}: ${chalk.green('"tms"')}
    - ${chalk.green('url')}: ${chalk.green(
			`"https://your-qas-instance.com/project/${this.project}/tcase/123"`
		)}

  Example:
  ${chalk.green(`{
  "links": [
    {
      "type": "tms",
      "url": "https://your-qas-instance.com/project/${this.project}/tcase/123"
    }
  ]
}`)}

  ${chalk.bold('Option 2: Include Test Case Marker in Name')}
  Include marker ${chalk.green(`${this.project}-<sequence>`)} in the test name:

  Format: ${chalk.green(`${this.project}-<sequence>: Your test name`)}
  Example: ${chalk.green(`${this.project}-1024: ${exampleTestName}`)}
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

		// Collect unique attachments, deduplicating by file path
		const uniqueAttachments = new Map<string, { attachment: Attachment; tcaseIndices: number[] }>()

		results.forEach((item, index) => {
			item.result.attachments.forEach((attachment) => {
				if (attachment.buffer !== null) {
					const existing = uniqueAttachments.get(attachment.filePath)
					if (existing) {
						existing.tcaseIndices.push(index)
					} else {
						uniqueAttachments.set(attachment.filePath, {
							attachment,
							tcaseIndices: [index],
						})
					}
				}
			})
		})

		if (uniqueAttachments.size === 0) {
			return results
		}

		const uniqueEntries = [...uniqueAttachments.values()]
		const totalRefs = uniqueEntries.reduce((sum, e) => sum + e.tcaseIndices.length, 0)
		const duplicateCount = totalRefs - uniqueEntries.length

		// Group attachments into batches where total size <= MAX_BATCH_SIZE_BYTES
		const batches: Array<typeof uniqueEntries> = []
		let currentBatch: typeof uniqueEntries = []
		let currentBatchSize = 0

		for (const item of uniqueEntries) {
			const size = item.attachment.buffer!.byteLength
			if (
				currentBatch.length > 0 &&
				(currentBatchSize + size > MAX_BATCH_SIZE_BYTES ||
					currentBatch.length >= MAX_BATCH_FILE_COUNT)
			) {
				batches.push(currentBatch)
				currentBatch = []
				currentBatchSize = 0
			}
			currentBatch.push(item)
			currentBatchSize += size
		}
		if (currentBatch.length > 0) {
			batches.push(currentBatch)
		}

		// Upload batches concurrently with progress tracking
		let uploadedCount = 0
		const duplicateMsg = duplicateCount > 0 ? ` (${duplicateCount} duplicates skipped)` : ''
		loader.start(`Uploading attachments: 0/${uniqueEntries.length} files uploaded${duplicateMsg}`)

		const batchResults = await this.processConcurrently(
			batches,
			async (batch) => {
				const files = batch.map(({ attachment }) => ({
					blob: new Blob([attachment.buffer! as BlobPart]),
					filename: attachment.filename,
				}))

				const uploaded = await this.api.files.upload(files)

				uploadedCount += batch.length
				loader.setText(
					`Uploading attachments: ${uploadedCount}/${uniqueEntries.length} files uploaded${duplicateMsg}`
				)

				return batch.map((item, i) => ({
					tcaseIndices: item.tcaseIndices,
					url: uploaded[i].url,
					name: item.attachment.filename,
				}))
			},
			MAX_CONCURRENT_BATCH_UPLOADS
		)
		loader.stop()

		// Flatten batch results and distribute URLs to all referencing test cases
		const attachmentsByTCase = new Map<number, Array<{ name: string; url: string }>>()
		for (const batchResult of batchResults) {
			for (const { tcaseIndices, url, name } of batchResult) {
				for (const tcaseIndex of tcaseIndices) {
					if (!attachmentsByTCase.has(tcaseIndex)) {
						attachmentsByTCase.set(tcaseIndex, [])
					}
					attachmentsByTCase.get(tcaseIndex)!.push({ url, name })
				}
			}
		}

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

			await this.api.results.createBatch(this.project, this.run, {
				items: batch.map(({ tcase, result }) => ({
					tcaseId: tcase.id,
					status: result.status,
					comment: result.message,
					timeTaken: result.timeTaken,
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
		return mapResolvedResultsToTCases(this.project, testcaseResults, testcases)
	}
}

export const setMaxResultsInRequest = (max: number) => {
	MAX_RESULTS_IN_REQUEST = max
}

const makeListHtml = (list: { name: string; url: string }[]) => {
	return `<ul>
${list.map((item) => `<li><a href="${escapeHtml(item.url)}">${escapeHtml(item.name)}</a></li>`).join('\n')}
</ul>`
}
