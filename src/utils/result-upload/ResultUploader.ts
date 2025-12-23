import { Arguments } from 'yargs'
import chalk from 'chalk'
import { RunTCase } from '../../api/schemas'
import { getTCaseMarker, parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { Attachment, TestCaseResult } from './types'
import {
    commandTypePrintMissingMarkerGuidance,
    ResultUploadCommandArgs,
    UploadCommandType,
} from './ResultUploadCommandHandler'

const MAX_CONCURRENT_FILE_UPLOADS = 10
let MAX_RESULTS_IN_REQUEST = 50 // Only updated from tests, otherwise it's a constant

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
		commandTypePrintMissingMarkerGuidance[this.type](this.project, missing[0]?.name)

		if (!this.args.createTcases) {
			console.error(
				chalk.yellow(
					`Also ensure that the test cases exist in the QA Sphere project${
						this.args.runUrl ? ' and the provided test run' : ''
					}.`
				)
			)
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
				const { url } = await this.api.files.uploadFile(
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
					const tcaseMarker = getTCaseMarker(this.project, tcase.seq)
					return (
						result.name.includes(tcaseMarker) || result.name.includes(tcaseMarker.replace('-', '_'))
					)
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

export const setMaxResultsInRequest = (max: number) => {
	MAX_RESULTS_IN_REQUEST = max
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
