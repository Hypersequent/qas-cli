import escapeHtml from 'escape-html'
import xml from 'xml2js'
import z from 'zod'
import { Attachment, TestCaseResult } from './types'
import { Parser } from './ResultUploadCommandHandler'
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
	attachmentBaseDirectory: string
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
			const result = getResult(tcase)
			const index =
				testcases.push({
					folder: suite.$.name,
					name: tcase.$.name,
					...result,
					attachments: [],
				}) - 1

			const attachmentPaths = []
			for (const out of tcase['system-out'] || []) {
				const text = typeof out === 'string' ? out : out._ ?? ''
				if (text) {
					attachmentPaths.push(...extractAttachmentPaths(text))
				}
			}

			attachmentsPromises.push({
				index,
				promise: getAttachments(attachmentPaths, attachmentBaseDirectory),
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
	tcase: z.infer<typeof testCaseSchema>
): { status: ResultStatus; message?: string } => {
	const err = tcase['system-err'] || []
	const out = tcase['system-out'] || []
	if (tcase.error)
		return {
			status: 'blocked',
			message: getResultMessage(
				{ result: tcase.error, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	if (tcase.failure)
		return {
			status: 'failed',
			message: getResultMessage(
				{ result: tcase.failure, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	if (tcase.skipped)
		return {
			status: 'skipped',
			message: getResultMessage(
				{ result: tcase.skipped, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	return {
		status: 'passed',
		message: getResultMessage({ result: out, type: 'code' }, { result: err, type: 'code' }),
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

const getResultMessage = (...options: GetResultMessageOption[]): string | undefined => {
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
