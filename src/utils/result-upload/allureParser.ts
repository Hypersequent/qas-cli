import z from 'zod'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import escapeHtml from 'escape-html'
import { TestCaseResult } from './types'
import { Parser, ParserOptions } from './ResultUploadCommandHandler'
import { ResultStatus } from '../../api/schemas'
import { getTCaseMarker, parseTCaseUrl } from '../misc'
import { getAttachments } from './utils'

// Zod schemas for Allure result files

const allureStatusSchema = z.enum(['passed', 'failed', 'broken', 'skipped', 'unknown'])

const allureStatusDetailsSchema = z
	.object({
		message: z.string().optional(),
		trace: z.string().optional(),
		known: z.boolean().optional(),
		muted: z.boolean().optional(),
		flaky: z.boolean().optional(),
	})
	.nullable()
	.optional()

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
	attachments: allureAttachmentSchema.array().nullable().optional(),
	labels: allureLabelSchema.array().nullable().optional(),
	links: allureLinkSchema.array().nullable().optional(),
	parameters: allureParameterSchema.array().nullable().optional(),
	steps: z.any().nullable().optional(),
})

type AllureResult = z.infer<typeof allureResultSchema>

const mapAllureStatus = (status: AllureResult['status']): ResultStatus => {
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
			return 'passed'
	}
}

const getFolderFromLabels = (labels: AllureResult['labels']): string => {
	if (!labels || labels.length === 0) return ''

	const labelMap = new Map<string, string>()
	for (const label of labels) {
		if (!labelMap.has(label.name)) {
			labelMap.set(label.name, label.value)
		}
	}

	return (
		labelMap.get('suite') ||
		labelMap.get('parentSuite') ||
		labelMap.get('feature') ||
		labelMap.get('package') ||
		''
	)
}

const getTCaseMarkerFromLinks = (links: AllureResult['links']): string | undefined => {
	if (!links || links.length === 0) return undefined

	for (const link of links) {
		if (link.type !== 'tms') continue

		// Try parsing as QA Sphere URL first
		const parsed = parseTCaseUrl(link.url)
		if (parsed) {
			return getTCaseMarker(parsed.project, parsed.tcaseSeq)
		}

		// Fall back to regex on link name
		if (link.name) {
			const match = link.name.match(/\b[A-Z]+-\d+\b/)
			if (match) {
				return match[0]
			}
		}
	}

	return undefined
}

const buildMessage = (
	result: AllureResult,
	status: ResultStatus,
	options: ParserOptions
): string => {
	let message = ''
	const details = result.statusDetails

	if (!details) return message

	const includeMessage = !(status === 'passed' && options.skipStdout === 'on-success')
	const includeTrace = !(status === 'passed' && options.skipStderr === 'on-success')

	if (includeMessage && details.message) {
		message += `<h4>Message:</h4><pre><code>${escapeHtml(details.message)}</code></pre>`
	}

	if (includeTrace && details.trace) {
		message += `<h4>Trace:</h4><pre><code>${escapeHtml(details.trace)}</code></pre>`
	}

	return message
}

/**
 * Parses Allure results from a directory of JSON result files.
 *
 * @param data - The directory path containing Allure result files (not file content).
 *               For Allure, the Parser's `data` parameter is a directory path since
 *               Allure results are spread across multiple files in a directory.
 * @param attachmentBaseDirectory - Same as `data` for Allure (the results directory).
 * @param options - Parser options for controlling output inclusion.
 */
export const parseAllureResults: Parser = async (
	data: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<TestCaseResult[]> => {
	const dirPath = data
	const entries = readdirSync(dirPath)
	const resultFiles = entries.filter((f) => f.endsWith('-result.json'))

	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<TestCaseResult['attachments']>
	}> = []

	for (const file of resultFiles) {
		const filePath = path.join(dirPath, file)
		let raw: string
		try {
			raw = readFileSync(filePath, 'utf8')
		} catch {
			console.warn(`Warning: Could not read file ${filePath}, skipping`)
			continue
		}

		let json: unknown
		try {
			json = JSON.parse(raw)
		} catch {
			console.warn(`Warning: Malformed JSON in ${filePath}, skipping`)
			continue
		}

		const parsed = allureResultSchema.safeParse(json)
		if (!parsed.success) {
			console.warn(`Warning: Invalid Allure result in ${filePath}, skipping`)
			continue
		}

		const result = parsed.data
		const status = mapAllureStatus(result.status)
		const folder = getFolderFromLabels(result.labels)
		const duration = result.stop - result.start

		// Extract test case marker: TMS links > test name
		const markerFromLinks = getTCaseMarkerFromLinks(result.links)
		const name = markerFromLinks ? `${markerFromLinks}: ${result.name}` : result.name

		const numTestcases = testcases.push({
			name,
			folder,
			status,
			message: buildMessage(result, status, options),
			timeTaken: duration,
			attachments: [],
		})

		// Collect attachment file paths
		const attachmentPaths: string[] = []
		if (result.attachments) {
			for (const attachment of result.attachments) {
				attachmentPaths.push(attachment.source)
			}
		}

		if (attachmentPaths.length > 0) {
			attachmentsPromises.push({
				index: numTestcases - 1,
				promise: getAttachments(attachmentPaths, attachmentBaseDirectory),
			})
		}
	}

	// Resolve all attachment promises
	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachments, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachments
	})

	return testcases
}
