import { Arguments } from 'yargs'
import { JUnitArgs } from '../../commands/junit-upload'
import { parseJUnitXml } from './junitXmlParser'
import chalk from 'chalk'
import { parseProjectUrl } from '../misc'
import { Api, createApi } from '../../api'
import { readFileSync } from 'fs'
import { dirname } from 'path'
import { JUnitCommandHandler } from './JUnitCommandHandler'
import { GetTCasesBySeqResponse, TCaseBySeq } from '../../api/tcases'
import { CreateRunResponse } from '../../api/run'

export class NewJUnitCommandHandler {
    private api: Api
    private apiToken: string
    private url: string
    private project: string

    constructor(private args: Arguments<JUnitArgs>) {
        const apiToken = process.env.QAS_TOKEN
        if (!apiToken) {
            throw new Error('QAS_TOKEN environment variable is required')
        }
        this.apiToken = apiToken

        const urlInfo = parseProjectUrl(args)
        this.url = urlInfo.url
        this.project = urlInfo.project
        this.api = createApi(this.url, this.apiToken)
    }

    async handle() {
        if (!this.args.files || this.args.files.length === 0) {
            throw new Error('No files specified')
        }

        // Try to use JUnitCommandHandler with current URL if it has run ID
        if (this.args.runUrl.includes('/run/')) {
            try {
                const handler = new JUnitCommandHandler({
                    ...this.args,
                    token: this.apiToken,
                })
                await handler.handle()
                return
            } catch (error) {
                console.log(chalk.yellow('Unable to use existing run, creating new one...'))
            }
        }
            
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
                        throw new Error(`Test case in ${file} has no name`)
                    }
                    continue
                }
                const match = /(\d{3,})/.exec(testcase.name)
                if (match) {
                    tcaseRefs.add(`${this.project}-${match[1]}`)
                } else if (!this.args.force) {
                    throw new Error(
                        `Test case name "${testcase.name}" in ${file} does not contain valid sequence number (e.g., 123)`
                    )
                }
            }
        }

        if (tcaseRefs.size === 0) {
            throw new Error('No valid test case references found in files')
        }

        return tcaseRefs
    }

    private async getTestCases(tcaseRefs: Set<string>) {
        const tcases = await this.api.testcases.getTCasesBySeq(this.project, {
            seqIds: Array.from(tcaseRefs),
        })

        if (tcases.tcases.length === 0) {
            throw new Error('No matching test cases found in the project')
        }

        return tcases
    }

    private async createNewRun(tcases: GetTCasesBySeqResponse) {
        const runId = await this.api.runs.createRun(this.project, {
            title: `Automated test run - ${new Date().toISOString()}`,
            description: 'Test run created through automation pipeline',
            type: 'static',
            queryPlans: [
                {
                    tcaseIds: tcases.tcases.map((t: TCaseBySeq) => t.id),
                },
            ],
        })

        console.log(chalk.green(`Created new test run with ID: ${runId.id}`))
        return runId
    }

    private async uploadResults(runId: CreateRunResponse) {
        const newRunUrl = `${this.url}/project/${this.project}/run/${runId.id}`
        const newHandler = new JUnitCommandHandler({
            ...this.args,
            runUrl: newRunUrl,
            token: this.apiToken,
        })
        await newHandler.handle()
    }
}