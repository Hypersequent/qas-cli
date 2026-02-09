import escapeHtml from 'escape-html'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import z from 'zod'
import { ResultStatus } from '../../api/schemas'
import { getTCaseMarker, parseTCaseUrl } from '../misc'
import { Parser, ParserOptions } from './ResultUploadCommandHandler'
import { Attachment, TestCaseResult } from './types'
import { getAttachments } from './utils'

const allureStatusSchema = z.enum(['passed', 'failed', 'broken', 'skipped', 'unknown'])

const allureStatusDetailsSchema = z
	.object({
		message: z.string().optional(),
		trace: z.string().optional(),
		known: z.boolean().optional(),
		muted: z.boolean().optional(),
		flaky: z.boolean().optional(),
	})
	.optional()
	.nullable()

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
	statusDetails: allureStatusDetailsSchema.optional().nullable(),
	attachments: allureAttachmentSchema.array().optional().nullable(),
	labels: allureLabelSchema.array().optional().nullable(),
	links: allureLinkSchema.array().optional().nullable(),
	parameters: allureParameterSchema.array().optional().nullable(),
	steps: z.unknown().optional().nullable(),
})

type AllureResult = z.infer<typeof allureResultSchema>

export const parseAllureResults: Parser = async (
	resultsDirectory: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<TestCaseResult[]> => {
	const entries = readdirSync(resultsDirectory, { withFileTypes: true })
	const resultFiles = entries
		.filter((entry) => entry.isFile() && entry.name.endsWith('-result.json'))
		.map((entry) => entry.name)

	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<Attachment[]>
	}> = []

	for (const filename of resultFiles) {
		const filePath = path.join(resultsDirectory, filename)
		let parsed: AllureResult

		try {
			const content = readFileSync(filePath, 'utf8')
			const json = JSON.parse(content)
			parsed = allureResultSchema.parse(json)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			console.warn(`Warning: Skipping Allure result "${filename}": ${message}`)
			continue
		}

		const status = mapAllureStatus(parsed.status)
		const folder = deriveFolder(parsed.labels ?? [])
		const name = applyMarkerFromLinks(parsed.name, parsed.links ?? [])
		const timeTaken = calculateDuration(parsed.start, parsed.stop)
		const message = buildMessage(parsed.statusDetails, status, options)

		const index =
			testcases.push({
				name,
				folder,
				status,
				message,
				timeTaken,
				attachments: [],
			}) - 1

		const attachmentSources = (parsed.attachments ?? []).map((attachment) => attachment.source)
		if (attachmentSources.length > 0) {
			attachmentsPromises.push({
				index,
				promise: getAttachments(attachmentSources, attachmentBaseDirectory),
			})
		}
	}

	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachments, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachments
	})

	return testcases
}

const mapAllureStatus = (status: z.infer<typeof allureStatusSchema>): ResultStatus => {
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
		default:
			return 'passed'
	}
}

const deriveFolder = (labels: z.infer<typeof allureLabelSchema>[]): string => {
	return (
		getLabelValue(labels, 'suite') ??
		getLabelValue(labels, 'parentSuite') ??
		getLabelValue(labels, 'feature') ??
		getLabelValue(labels, 'package') ??
		''
	)
}

const getLabelValue = (labels: z.infer<typeof allureLabelSchema>[], name: string) => {
	return labels.find((label) => label.name === name)?.value
}

const calculateDuration = (start: number, stop: number) => {
	const duration = stop - start
	return Number.isFinite(duration) && duration >= 0 ? duration : null
}

const buildMessage = (
	statusDetails: z.infer<typeof allureStatusDetailsSchema>,
	status: ResultStatus,
	options: ParserOptions
) => {
	let message = ''

	const includeStdout = !(status === 'passed' && options.skipStdout === 'on-success')
	const includeStderr = !(status === 'passed' && options.skipStderr === 'on-success')

	if (includeStdout && statusDetails?.message) {
		message += `<pre><code>${escapeHtml(statusDetails.message)}</code></pre>`
	}
	if (includeStderr && statusDetails?.trace) {
		message += `<pre><code>${escapeHtml(statusDetails.trace)}</code></pre>`
	}

	return message
}

const applyMarkerFromLinks = (name: string, links: z.infer<typeof allureLinkSchema>[]) => {
	const markerFromLinks = getMarkerFromLinks(links)
	if (!markerFromLinks) {
		return name
	}

	if (name.includes(markerFromLinks)) {
		return name
	}

	return `${markerFromLinks}: ${name}`
}

const getMarkerFromLinks = (links: z.infer<typeof allureLinkSchema>[]) => {
	for (const link of links) {
		if (link.type !== 'tms') {
			continue
		}

		if (link.url) {
			const parsed = parseTCaseUrl(link.url)
			if (parsed) {
				return getTCaseMarker(parsed.project, parsed.tcaseSeq)
			}
		}

		if (link.name) {
			const match = link.name.match(/\b([A-Z]+)-(\d+)\b/)
			if (match) {
				const seq = Number(match[2])
				if (Number.isFinite(seq)) {
					return getTCaseMarker(match[1], seq)
				}
			}
		}
	}
}
