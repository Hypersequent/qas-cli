import escapeHtml from 'escape-html'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import stripAnsi from 'strip-ansi'
import z from 'zod'
import { ResultStatus } from '../../api/schemas'
import { getTCaseMarker, parseTCaseUrl } from '../misc'
import { Parser, ParserOptions } from './ResultUploadCommandHandler'
import { Attachment, TestCaseResult } from './types'
import { getAttachments } from './utils'

const allureStatusSchema = z.enum(['passed', 'failed', 'broken', 'skipped', 'unknown'])
type AllureStatus = z.infer<typeof allureStatusSchema>

const allureStatusDetailsSchema = z
	.object({
		message: z.string().optional(),
		trace: z.string().optional(),
		known: z.boolean().optional(),
		muted: z.boolean().optional(),
		flaky: z.boolean().optional(),
	})
	.nullish()

const allureAttachmentSchema = z.object({
	name: z.string(),
	source: z.string(),
	type: z.string(),
})

const allureLabelSchema = z.object({
	name: z.string(),
	value: z.string(),
})

const allureParameterSchema = z.object({
	name: z.string(),
	value: z.string(),
	excluded: z.boolean().optional(),
	mode: z.enum(['default', 'masked', 'hidden']).optional(),
})

const allureLinkSchema = z.object({
	name: z.string().optional(),
	url: z.string(),
	type: z.string().optional(),
})

const allureResultSchema = z.object({
	name: z.string(),
	status: allureStatusSchema,
	uuid: z.string(),
	start: z.number(),
	stop: z.number(),
	fullName: z.string().optional(),
	historyId: z.string().optional(),
	testCaseId: z.string().optional(),
	description: z.string().optional(),
	descriptionHtml: z.string().optional(),
	stage: z.string().optional(),
	statusDetails: allureStatusDetailsSchema,
	attachments: z.array(allureAttachmentSchema).nullish(),
	labels: z.array(allureLabelSchema).nullish(),
	links: z.array(allureLinkSchema).nullish(),
	parameters: z.array(allureParameterSchema).nullish(),
	steps: z.array(z.unknown()).nullish(),
})

type AllureResult = z.infer<typeof allureResultSchema>

const markerRegex = /\b([A-Za-z0-9]{1,5})-(\d+)\b/

export const parseAllureResults: Parser = async (
	resultsDirectory: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<TestCaseResult[]> => {
	const resultFiles = readdirSync(resultsDirectory)
		.filter((f) => f.endsWith('-result.json'))
		.sort()

	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<Attachment[]>
	}> = []
	const allowPartialParse = options.allowPartialParse ?? false

	for (const resultFile of resultFiles) {
		const resultFilePath = join(resultsDirectory, resultFile)

		let parsedResult: AllureResult
		try {
			const fileContent = readFileSync(resultFilePath, 'utf8')
			parsedResult = allureResultSchema.parse(JSON.parse(fileContent))
		} catch (error) {
			if (allowPartialParse) {
				console.warn(
					`Warning: Skipping invalid Allure result file "${resultFilePath}": ${getErrorMessage(error)}`
				)
				continue
			}

			throw new Error(
				`Failed to parse Allure result file "${resultFilePath}": ${getErrorMessage(error)}`
			)
		}

		const status = mapAllureStatus(parsedResult.status)
		const marker = extractMarker(parsedResult)
		const index =
			testcases.push({
				name: marker ? `${marker}: ${parsedResult.name}` : parsedResult.name,
				folder: getFolder(parsedResult),
				status,
				message: buildMessage(parsedResult, status, options),
				timeTaken:
					parsedResult.stop >= parsedResult.start ? parsedResult.stop - parsedResult.start : null,
				attachments: [],
			}) - 1

		const attachmentPaths = (parsedResult.attachments || []).map((attachment) => attachment.source)
		attachmentsPromises.push({
			index,
			promise: getAttachments(attachmentPaths, attachmentBaseDirectory || resultsDirectory),
		})
	}

	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachment, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachment
	})

	return testcases
}

const mapAllureStatus = (status: AllureStatus): ResultStatus => {
	switch (status) {
		case 'passed':
			return 'passed'
		case 'failed':
			return 'failed'
		case 'broken':
			return 'blocked'
		case 'skipped':
			return 'skipped'
		case 'unknown':
			return 'open'
		default:
			return 'open'
	}
}

const getFolder = (result: AllureResult): string => {
	const labels = result.labels || []
	const folderLabelPriority = ['suite', 'parentSuite', 'feature', 'package']

	for (const labelName of folderLabelPriority) {
		const label = labels.find((item) => item.name === labelName)
		if (label?.value) {
			return label.value
		}
	}

	return ''
}

const buildMessage = (
	result: AllureResult,
	status: ResultStatus,
	options: ParserOptions
): string => {
	const statusDetails = result.statusDetails
	if (!statusDetails) {
		return ''
	}

	const includeStdout = !(status === 'passed' && options.skipStdout === 'on-success')
	const includeStderr = !(status === 'passed' && options.skipStderr === 'on-success')

	let message = ''

	if (includeStdout && statusDetails.message) {
		message += `<pre><code>${escapeHtml(stripAnsi(statusDetails.message))}</code></pre>`
	}
	if (includeStderr && statusDetails.trace) {
		message += `<pre><code>${escapeHtml(stripAnsi(statusDetails.trace))}</code></pre>`
	}

	return message
}

const extractMarker = (result: AllureResult): string | undefined => {
	return getMarkerFromTmsLinks(result.links) || getMarkerFromText(result.name)
}

const getMarkerFromTmsLinks = (links: AllureResult['links']): string | undefined => {
	const tmsLinks = (links || []).filter((link) => link.type?.toLowerCase() === 'tms')

	for (const link of tmsLinks) {
		const parsed = parseTCaseUrl(link.url)
		if (parsed) {
			return getTCaseMarker(parsed.project, parsed.tcaseSeq)
		}
	}

	for (const link of tmsLinks) {
		const markerFromName = getMarkerFromText(link.name)
		if (markerFromName) {
			return markerFromName
		}
	}

	return undefined
}

const getMarkerFromText = (text: string | undefined): string | undefined => {
	if (!text) {
		return undefined
	}

	const match = text.match(markerRegex)
	if (!match) {
		return undefined
	}

	return getTCaseMarker(match[1], Number(match[2]))
}

const getErrorMessage = (error: unknown) => {
	return error instanceof Error ? error.message : String(error)
}
