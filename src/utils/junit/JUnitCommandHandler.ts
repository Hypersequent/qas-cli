import { Arguments } from 'yargs'
import { JUnitArgs } from '../../commands/junit-upload'
import { parseJUnitXml, type JUnitResultType, type JUnitTestCase } from './junitXmlParser'
import chalk from 'chalk'
import { ResultStatus, RunTCase } from '../../api/schemas'
import { parseApiToken, parseRunUrl, printError, printErrorThenExit, twirlLoader } from '../misc'
import { Api, createApi } from '../../api'
import { readFileSync } from 'fs'
import { dirname } from 'path'

export class JUnitCommandHandler {
	private api: Api

	private project: string

	private run: number

	constructor(private args: Arguments<JUnitArgs>) {
		const apiToken = parseApiToken(args)
		const {url, project, run} = parseRunUrl(args)

		this.project = project
		this.run = run
		this.api = createApi(url, apiToken)
	}

	async handle() {
		const junitResults : JUnitTestCase[] = []

		console.log(`Uploading files [${this.args.files.map((f) => chalk.green(f)).join(", ")}]`+
		` to run [${chalk.green(this.run)}] of project [${chalk.green(this.project)}]`)

		for (const file of this.args.files) {
			const xmlString = readFileSync(file).toString()
			const { testcases: results } = await parseJUnitXml(xmlString, dirname(file))
			junitResults.push(...results)
		}

		const tcases = await this.api.runs
			.getRunTCases(this.project, this.run)
			.catch(printErrorThenExit)

		const { results, missing } = this.mapTestCaseResults(junitResults, tcases)
		this.validateAndPrintMissingTestCases(missing)
		this.validateAndPrintMissingAttachments(results)
		await this.uploadTestCases(results)

		console.log(`Uploaded ${results.length} test cases`)
	}

	private validateAndPrintMissingTestCases(missing: JUnitTestCase[]) {
		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			const header = this.args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
			console.error(
				`${header}${chalk.blue(`${folderMessage} "${item.name}"`)} does not match any test cases`
			)
		})
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
					comment += `\n<p>Attachments:</p>\n${makeListHtml(attachmentUrls)}`
				}

				await this.api.runs.createResultStatus(this.project, this.run, tcase.id, {
					status: getResult(result.type),
					comment,
				})
			}
			loader.stop()
		} catch (e) {
			loader.stop()
			printErrorThenExit(e)
		}
	}

	private mapTestCaseResults = (junitTCases: JUnitTestCase[], testcases: RunTCase[]) => {
		const results: TCaseWithResult[] = []
		const missing: JUnitTestCase[] = []

		junitTCases.forEach((result) => {
			const tcase = testcases.find((tcase) => {
				if (!result.name) return false

				const tcaseCode = `${this.project}-${tcase.seq.toString().padStart(3, '0')}`
				return result.name.includes(tcaseCode)
			})
			if (tcase) {
				results.push({
					result,
					tcase,
				})
				return
			}
			missing.push(result)
		})

		return { results, missing }
	}
}

interface TCaseWithResult {
	tcase: RunTCase
	result: JUnitTestCase
}

const makeListHtml = (list: { name: string; url: string }[]) => {
	return `<ul>
${list.map((item) => `<li><a href="${item.url}">${item.name}</a></li>`).join('\n')}
</ul>`
}

const getResult = (result: JUnitResultType): ResultStatus => {
	switch (result) {
		case 'error':
			return 'blocked'
		case 'failure':
			return 'failed'
		case 'skipped':
			return 'skipped'
		case 'success':
			return 'passed'
	}
}
