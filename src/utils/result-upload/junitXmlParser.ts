import escapeHtml from 'escape-html'
import xml from 'xml2js'
import z from 'zod'
import { Attachment, TestCaseResult } from './types'
import { Parser, ParserOptions } from './ResultUploadCommandHandler'
import { ResultStatus } from '../../api/schemas'
import { getAttachments } from './utils'

// Note about junit xml schema:
// there are multiple schemas on the internet, and apparently some are more strict than others
// we have to use LESS strict schema (see one from Jest, based on Jenkins JUnit schema)
// see https://github.com/jest-community/jest-junit/blob/master/__tests__/lib/junit.xsd#L42

const stringContent = z.object({
	_: z.string().optional(),
})

const failureErrorSchema = stringContent.extend({
	$: z
		.object({
			message: z.string().optional(),
			type: z.string().optional(), // type attribute is optional (some test runners like Jest don't include it)
		})
		.optional(),
})

// As per https://github.com/windyroad/JUnit-Schema/blob/master/JUnit.xsd, only message attribute
// and text content can be present for skipped (both optional)
// 1. If message attribute or text content is present, skipped is parsed as an object
// 2. If skipped is empty (no message attribute and text content), skipped is parsed as an string
const skippedSchema = z.union([
	z.string(),
	stringContent.extend({
		$: z
			.object({
				message: z.string().optional(),
			})
			.optional(),
	}),
])

const testCaseSchema = z.object({
	$: z.object({
		name: z.string().optional(),
		classname: z.string().optional(),
		time: z.string().optional(),
	}),
	// Some JUnit producers emit empty tags like <system-err></system-err> which
	// xml2js may parse as empty strings. Accept both object and string forms.
	'system-out': z.array(z.union([stringContent, z.string()])).optional(),
	'system-err': z.array(z.union([stringContent, z.string()])).optional(),
	failure: z.array(failureErrorSchema).optional(),
	skipped: z.array(skippedSchema).optional(),
	error: z.array(failureErrorSchema).optional(),
})

const junitXmlSchema = z.object({
	testsuites: z.object({
		$: z.object({
			name: z.string().optional(),
			time: z.string().optional(),
			timeStamp: z.string().optional(),
		}),
		testsuite: z.array(
			z.object({
				$: z.object({
					name: z.string().optional(),
					time: z.string().optional(),
					timeStamp: z.string().optional(),
				}),
				testcase: z.array(testCaseSchema).optional(),
			})
		),
	}),
})

export const parseJUnitXml: Parser = async (
	xmlString: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<TestCaseResult[]> => {
	const xmlData = await xml.parseStringPromise(xmlString, {
		explicitCharkey: true,
		includeWhiteChars: true,
	})
	const validated = junitXmlSchema.parse(xmlData)
	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<Attachment[]>
	}> = []

	for (const suite of validated.testsuites.testsuite) {
		for (const tcase of suite.testcase ?? []) {
			const result = getResult(tcase, options)
			const timeTakenSeconds = Number.parseFloat(tcase.$.time ?? '')
			// Use classname as folder when available, as it provides more meaningful
			// grouping for test runners like pytest that put all tests in a single
			// generic suite (e.g., "pytest"). For runners where classname matches the
			// suite name (e.g., Playwright), this produces the same result.
			const folder = tcase.$.classname ?? suite.$.name ?? ''
			const index =
				testcases.push({
					...result,
					folder,
					name: tcase.$.name ?? '',
					timeTaken:
						Number.isFinite(timeTakenSeconds) && timeTakenSeconds >= 0
							? timeTakenSeconds * 1000
							: null,
					attachments: [],
				}) - 1

			const attachmentPaths = new Set<string>()

			// Extract from system-out
			for (const out of tcase['system-out'] || []) {
				const text = typeof out === 'string' ? out : (out._ ?? '')
				if (text) {
					extractAttachmentPaths(text).forEach((path) => attachmentPaths.add(path))
				}
			}

			// Helper function to extract attachments from failure/error/skipped elements
			const extractAttachmentsFromElements = (
				elements: (string | { _?: string; $?: { message?: string } })[] | undefined
			) => {
				for (const element of elements || []) {
					if (typeof element === 'string') {
						extractAttachmentPaths(element).forEach((path) => attachmentPaths.add(path))
					} else if (typeof element === 'object') {
						if (element.$?.message) {
							extractAttachmentPaths(element.$.message).forEach((path) => attachmentPaths.add(path))
						}
						if (element._) {
							extractAttachmentPaths(element._).forEach((path) => attachmentPaths.add(path))
						}
					}
				}
			}

			// Extract attachments from failure, error, and skipped elements
			extractAttachmentsFromElements(tcase.failure)
			extractAttachmentsFromElements(tcase.error)
			extractAttachmentsFromElements(tcase.skipped)

			attachmentsPromises.push({
				index,
				promise: getAttachments(Array.from(attachmentPaths), attachmentBaseDirectory),
			})
		}
	}

	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachment, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachment
	})

	return testcases
}

const getResult = (
	tcase: z.infer<typeof testCaseSchema>,
	options: ParserOptions
): { status: ResultStatus; message: string } => {
	const err = tcase['system-err'] || []
	const out = tcase['system-out'] || []

	// Determine test status first
	let status: ResultStatus
	let mainResult: GetResultMessageOption | undefined

	if (tcase.error) {
		status = 'blocked'
		mainResult = { result: tcase.error, type: 'code' }
	} else if (tcase.failure) {
		status = 'failed'
		mainResult = { result: tcase.failure, type: 'code' }
	} else if (tcase.skipped) {
		status = 'skipped'
		mainResult = { result: tcase.skipped, type: 'code' }
	} else {
		status = 'passed'
	}

	// Conditionally include stdout/stderr based on status and options
	const includeStdout = !(status === 'passed' && options.skipStdout === 'on-success')
	const includeStderr = !(status === 'passed' && options.skipStderr === 'on-success')

	const messageOptions: GetResultMessageOption[] = []
	if (mainResult) {
		messageOptions.push(mainResult)
	}
	if (includeStdout) {
		messageOptions.push({ result: out, type: 'code' })
	}
	if (includeStderr) {
		messageOptions.push({ result: err, type: 'code' })
	}

	return {
		status,
		message: getResultMessage(...messageOptions),
	}
}

interface GetResultMessageOption {
	result?: (
		| string
		| Partial<z.infer<typeof failureErrorSchema>>
		| Partial<z.infer<typeof skippedSchema>>
	)[]
	type?: 'paragraph' | 'code'
}

const getResultMessage = (...options: GetResultMessageOption[]): string => {
	let message = ''
	options.forEach((option) => {
		option.result?.forEach((r) => {
			// Handle both string and object formats from xml2js parsing
			const content = (typeof r === 'string' ? r : r._)?.trim()
			if (!content) return

			if (!option.type || option.type === 'paragraph') {
				message += `<p>${escapeHtml(content)}</p>`
				return
			} else if (option.type === 'code') {
				message += `<pre><code>${escapeHtml(content)}</code></pre>`
				return
			}
		})
	})
	return message
}

const extractAttachmentPaths = (content: string) => {
	const regex = /^\[\[ATTACHMENT\|(.+)\]\]$/gm
	const matches = content.matchAll(regex)
	const paths: string[] = []
	Array.from(matches).map((match) => {
		paths.push(match[1])
	})
	return paths
}
