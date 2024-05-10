import { readFileSync } from 'fs'
import { Arguments, Argv, CommandModule } from 'yargs'
import { JUnitResultType, JUnitTestCase, parseJUnitXml } from '../utils/junit'
import { createApi } from '../api'
import chalk from 'chalk'
import { twirlLoader } from '../utils/misc'
import { ResultStatus, RunTCase } from '../api/schemas'

export interface JUnitArgs {
	subdomain: string
	zone: string
	project: string
	run: number
	token: string
	file: string
}

export class JUnitUploadCommandModule implements CommandModule<unknown, JUnitArgs> {
	command = 'junit-upload [args..] <file>'

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
			help: {
				alias: 'h',
				help: true,
			},
		})

		argv.check(async (args) => {
			return !!parseUrl(args)
		})

		argv.example(
			'$0 junit-upload -d qas -z eu1 -p P1 -r 23 -t API_TOKEN ./path/to/junit.xml ',
			'Upload JUnit xml file to https://qas.eu1.hpsq.io/project/P1/run/23'
		)

		argv.example(
			'$0 junit-upload --url qas.eu1.hpsq.io -p P1 -r 23 -t API_TOKEN  ./path/to/junit.xml',
			'Upload JUnit xml file to https://qas.eu1.hpsq.io/project/P1/run/23'
		)

		argv.showHelpOnFail(false)

		return argv as Argv<JUnitArgs>
	}

	handler = async (args: Arguments<JUnitArgs>) => {
		const api = createApi(parseUrl(args), args.token)
		const file = readFileSync(args.file).toString()
		const { testcases: junitResults } = await parseJUnitXml(file)
		const tcases = await api.runs.getRunTCases(args.project, args.run)
		const { results, missing } = mapTestCaseResults(junitResults, tcases)
		const loader = twirlLoader()

		missing.forEach((item) => {
			const folderMessage = item.folder ? ` "${item.folder}" ->` : ''
			console.log(
				`${chalk.yellow('Warning:')}${chalk.blue(
					`${folderMessage} "${item.name}"`
				)} does not match any test cases`
			)
		})

		loader.start()
		try {
			for (let i = 0; i < results.length; i++) {
				const { tcase, result } = results[i]
				loader.setText(`Uploading test case ${i + 1} of ${results.length}`)
				await api.runs.createResultStatus(args.project, args.run, tcase.id, {
					status: getResult(result.result.type),
					comment: result.result.resultMessage,
				})
			}
		} catch (e) {
			console.error(e)
			process.exit(1)
		}
		loader.stop()

		console.log(`Uploaded ${results.length} test cases`)
	}
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
