import { Arguments, Argv, CommandModule } from 'yargs'
import { createApi } from '../api'
import { dirname } from 'path'
import { readFileSync } from 'fs'
import { parseJUnitXml } from '../utils/junit/junitXmlParser'
import chalk from 'chalk'
import { JUnitArgs } from './junit-upload'

interface NewJUnitTestRunArgs {
	p: string
	files: string[]
	force?: boolean
	attachments?: boolean
}

export class NewJUnitTestRunCommandModule implements CommandModule<unknown, NewJUnitTestRunArgs> {
	command = 'new-junit-testrun <files..>'
	describe = 'Create a new test run from JUnit XML files and upload results'

	builder = (argv: Argv) => {
		return argv
			.positional('files', {
				describe: 'JUnit XML files to process',
				type: 'string',
				array: true,
			})
			.option('p', {
				describe: 'Full URL to the project (e.g.,https://qas.eu1.qasphere.com/project/P1)',
				type: 'string',
				demandOption: true,
				requiresArg: true,
			})
			.option('attachments', {
				describe: 'Try to detect any attachments and upload it with the test result',
				type: 'boolean',
			})
			.option('force', {
				describe: 'Ignore API request errors, invalid test cases or attachments',
				type: 'boolean',
			})
			.example(
				'$0 new-junit-testrun -p https://qas.eu1.qasphere.com/project/P1 ./test-results.xml',
				'Create new test run from test-results.xml and upload results'
			)
			.example(
				'$0 new-junit-testrun -p https://qas.eu1.qasphere.com/project/P1 file1.xml file2.xml --force',
				'Create new test run with multiple files in force mode'
			) as Argv<NewJUnitTestRunArgs>
	}

	private parseProjectUrl(url: string): { baseUrl: string; projectCode: string } {
		try {
			const urlObj = new URL(url)
			const pathParts = urlObj.pathname.split('/')
			const projectIndex = pathParts.findIndex((part) => part === 'project')

			if (projectIndex === -1 || !pathParts[projectIndex + 1]) {
				throw new Error('Invalid project URL format')
			}

			return {
				baseUrl: `${urlObj.protocol}//${urlObj.host}`,
				projectCode: pathParts[projectIndex + 1].toUpperCase(), // Only take the project code, e.g. 'BD'
			}
		} catch (error) {
			throw new Error(
				'Invalid project URL. Please provide a valid URL (e.g., http://tenant1.localhost:5173/project/BD)'
			)
		}
	}

	handler = async (args: Arguments<NewJUnitTestRunArgs>) => {
		const apiToken = process.env.QAS_TOKEN
		if (!apiToken) {
			throw new Error('QAS_TOKEN environment variable is required')
		}

		if (!args.files || args.files.length === 0) {
			throw new Error('No files specified')
		}

		// Parse project URL to get base URL and project code
		const { baseUrl, projectCode } = this.parseProjectUrl(args.p)

		// Extract test case IDs from all files
		const tcaseRefs = new Set<string>()

		for (const file of args.files) {
			const xmlContent = readFileSync(file).toString()
			const { testcases } = await parseJUnitXml(xmlContent, dirname(file))

			for (const testcase of testcases) {
				if (!testcase.name) {
					if (!args.force) {
						throw new Error(`Test case in ${file} has no name`)
					}
					continue
				}

				const seq = this.extractSeqNumber(testcase.name)
				if (seq) {
					tcaseRefs.add(`${projectCode}-${seq}`)
				} else if (!args.force) {
					throw new Error(
						`Test case name "${testcase.name}" in ${file} does not contain valid sequence number (e.g., 123)`
					)
				}
			}
		}

		if (tcaseRefs.size === 0) {
			throw new Error('No valid test case references found in files')
		}

		const api = createApi(`${baseUrl}`, apiToken)

		const tcases = await api.testcases.getTCasesBySeq(projectCode, {
			seqIds: Array.from(tcaseRefs),
		})

		if (tcases.tcases.length === 0) {
			throw new Error('No matching test cases found in the project')
		}

		// Create new run
		const runId = await api.runs.createRun(projectCode, {
			title: `Automated test run - ${new Date().toISOString()}`,
			description: 'Test run created through automation pipeline',
			type: 'static',
			queryPlans: [
				{
					tcaseIds: tcases.tcases.map((t) => t.id),
				},
			],
		})

		console.log(chalk.green(`Created new test run with ID: ${runId.id}`))

		// Upload results using JUnitUploadCommandModule
		const runUrl = `${baseUrl}/project/${projectCode}/run/${runId.id}`
		const JUnitUploadCommandModule = (await import('./junit-upload')).JUnitUploadCommandModule
		const uploadCommand = new JUnitUploadCommandModule()
		await uploadCommand.handler({
			runUrl,
			files: args.files,
			force: args.force,
			attachments: args.attachments,
			token: apiToken,
			_: [],
			$0: '',
		} as Arguments<JUnitArgs>)
	}

	private extractSeqNumber(name: string): string | null {
		const match = /(\d{3,})/.exec(name)
		return match ? match[1] : null
	}
}
