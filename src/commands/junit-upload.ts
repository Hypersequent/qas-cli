import { readFileSync } from 'fs'
import { Arguments, Argv, CommandModule } from 'yargs'
import { JUnitResultType, JUnitTestCase, parseJUnitXml } from '../utils/junit/junitXmlParser'
import { createApi } from '../api'
import chalk from 'chalk'
import { twirlLoader } from '../utils/misc'
import { ResultStatus, RunTCase } from '../api/schemas'
import { API_TOKEN } from '../config/env'
import { dirname } from 'path'

export interface JUnitArgs {
	subdomain: string
	zone: string
	project: string
	run: number
	token: string
	file: string
	force: boolean
	detectAttachments: boolean
}

export class JUnitUploadCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'junit-upload [args..] <file>'
	describe = 'upload JUnit xml files'

	builder = (argv: Argv) => {
		argv.options({
			subdomain: {
				alias: 's',
				type: 'string',
				describe: 'URL subdomain',
				requiresArg: true,
			},
			zone: {
				alias: 'z',
				type: 'string',
				describe: 'URL zone',
				requiresArg: true,
			},
			project: {
				alias: 'p',
				type: 'string',
				describe: 'Project code',
				demandOption: true,
				requiresArg: true,
			},
			run: {
				alias: 'r',
				type: 'number',
				describe: 'Run ID',
				demandOption: true,
				requiresArg: true,
			},
			token: {
				alias: 't',
				describe: 'API token',
				type: 'string',
				requiresArg: true,
			},
			url: {
				describe: 'Instance URL',
				type: 'string',
				requiresArg: true,
			},
			detectAttachments: {
				describe: 'Try to detect any attachments and upload it with the test result',
				type: 'boolean',
				requiresArg: true,
			},
			force: {
				describe: 'Ignore API request errors, invalid test cases or attachments',
				type: 'boolean',
			},
			help: {
				alias: 'h',
				help: true,
			},
		})

		argv.check((args) => {
			return !!parseUrl(args)
		})

		argv.check((args) => {
			if (!args.token && !API_TOKEN) {
				throw new Error('-t <token> or QAS_TOKEN environment variable must be present')
			}
			return true
		})

		argv.example(
			'$0 junit-upload -d qas -z eu1 -p P1 -r 23 -t API_TOKEN ./path/to/junit.xml ',
			'Upload JUnit xml file to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		argv.example(
			'$0 junit-upload --url qas.eu1.hpsq.io -p P1 -r 23 -t API_TOKEN  ./path/to/junit.xml',
			'Upload JUnit xml file to https://qas.eu1.qasphere.com/project/P1/run/23'
		)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		const apiToken = args.token || (API_TOKEN as string)
		const url = parseUrl(args)
		const api = createApi(url, apiToken)
		const file = readFileSync(args.file).toString()
		const { testcases: junitResults } = await parseJUnitXml(file, dirname(args.file))
		const tcases = await api.runs.getRunTCases(args.project, args.run).catch(printErrorThenExit)
		const { results, missing } = mapTestCaseResults(junitResults, tcases)
		const loader = twirlLoader()

		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			const header = args.force ? chalk.yellow('Warning:') : chalk.red('Error:')
			console.error(
				`${header}${chalk.blue(`${folderMessage} "${item.name}"`)} does not match any test cases`
			)
		})
		if (missing.length && !args.force) {
			process.exit(1)
		}

		if (args.detectAttachments) {
			let hasAttachmentErrors = false
			results.forEach(({ result }) => {
				result.attachments.forEach((attachment) => {
					if (attachment.error) {
						printError(attachment.error)
						hasAttachmentErrors = true
					}
				})
			})
			if (hasAttachmentErrors && !args.force) {
				process.exit(1)
			}
		}

		loader.start()
		try {
			for (let i = 0; i < results.length; i++) {
				const { tcase, result } = results[i]
				loader.setText(`Uploading test case ${i + 1} of ${results.length}`)
				const attachmentUrls: Array<{ name: string; url: string }> = []
				for (const attachment of result.attachments) {
					if (attachment.buffer) {
						const { url } = await api.file.uploadFile(
							new File([attachment.buffer], attachment.filename)
						)
						attachmentUrls.push({ url, name: attachment.filename })
					}
				}

				await api.runs.createResultStatus(args.project, args.run, tcase.id, {
					status: getResult(result.type),
					comment: result.message + `\n<p>Attachments:</p>\n${makeListHtml(attachmentUrls)}`,
				})
			}
		} catch (e) {
			printErrorThenExit(e)
		}
		loader.stop()

		console.log(`Uploaded ${results.length} test cases`)
	}
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

interface TCaseWithResult {
	tcase: RunTCase
	result: JUnitTestCase
}

const mapTestCaseResults = (junitTCases: JUnitTestCase[], testcases: RunTCase[]) => {
	const results: TCaseWithResult[] = []
	const missing: JUnitTestCase[] = []

	junitTCases.forEach((result) => {
		const tcase = testcases.find(
			(tcase) => tcase.title === result.name && result.folder === tcase.folder.title
		)
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

const parseUrl = (args: Record<string, unknown>): string => {
	if (typeof args.url === 'string') {
		if (args.url.includes('://')) {
			return args.url
		}
		return `http://${args.url}`
	}
	if (typeof args.s === 'string' && typeof args.z === 'string') {
		return `https://${args.s}.${args.z}.qasphere.com`
	}

	throw new Error('missing parameters -z and -s or --url')
}

const printErrorThenExit = (e: unknown): never => {
	printError(e)
	process.exit(1)
}

const printError = (e: unknown) => {
	if (e instanceof Error) {
		console.error(e)
	} else {
		console.error(e)
	}
}
