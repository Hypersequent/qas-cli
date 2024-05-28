import path, { basename } from 'path'
import escapeHtml from 'escape-html'
import { readFile } from 'fs/promises'
import xml from 'xml2js'
import z from 'zod'

const stringContent = z.object({
	_: z.string().optional(),
})

const resultSchema = stringContent.extend({
	$: z.object({
		message: z.string().optional(),
		type: z.string().optional(),
	}),
})

const testCaseSchema = z.object({
	$: z.object({
		name: z.string().optional(),
		time: z.string().optional(),
	}),
	'system-out': z.array(stringContent).optional(),
	'system-err': z.array(stringContent).optional(),
	failure: z.array(resultSchema).optional(),
	skipped: z.array(resultSchema).optional(),
	error: z.array(resultSchema).optional(),
})

const xmlSchema = z.object({
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
				testcase: z.array(testCaseSchema),
			})
		),
	}),
})

export type JUnitResultType = 'failure' | 'error' | 'skipped' | 'success'

export interface JUnitAttachment {
	path: string
	buffer: Buffer | null
	error: Error | null
	filename: string
}

export interface JUnitTestCase extends JUnitResult {
	name?: string
	folder?: string
	logs?: string
	attachments: JUnitAttachment[]
}

export interface ParseResult {
	testcases: JUnitTestCase[]
}

export const parseJUnitXml = async (xmlString: string, basePath: string): Promise<ParseResult> => {
	const xmlData = await xml.parseStringPromise(xmlString, {
		explicitCharkey: true,
		includeWhiteChars: true,
	})
	const validated = xmlSchema.parse(xmlData)
	const testcases: JUnitTestCase[] = []
	const attachmentsPromises: Array<{ index: number; promise: Promise<JUnitAttachment[]> }> = []

	for (const suite of validated.testsuites.testsuite) {
		for (const tcase of suite.testcase) {
			const result = getResult(tcase)
			const index =
				testcases.push({
					folder: suite.$.name,
					name: tcase.$.name,
					...result,
					attachments: [],
				}) - 1
			const attachments = getAttachments(tcase, basePath)
			attachmentsPromises.push({
				index,
				promise: attachments,
			})
		}
	}

	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachment, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachment
	})

	return { testcases }
}

interface JUnitResult {
	type: JUnitResultType
	message?: string
}

const getResult = (tcase: z.infer<typeof testCaseSchema>): JUnitResult => {
	const err = tcase['system-err'] || []
	const out = tcase['system-out'] || []
	if (tcase.error)
		return {
			type: 'error',
			message: getResultMessage(
				{ result: tcase.error, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	if (tcase.failure)
		return {
			type: 'failure',
			message: getResultMessage(
				{ result: tcase.failure, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	if (tcase.skipped)
		return {
			type: 'skipped',
			message: getResultMessage(
				{ result: tcase.skipped, type: 'code' },
				{ result: out, type: 'code' },
				{ result: err, type: 'code' }
			),
		}
	return {
		type: 'success',
		message: getResultMessage({ result: out, type: 'code' }, { result: err, type: 'code' }),
	}
}

interface GetResultMessageOption {
	result?: Partial<z.infer<typeof resultSchema>>[]
	type?: 'paragraph' | 'code'
}

const getResultMessage = (...options: GetResultMessageOption[]): string | undefined => {
	let message = ''
	options.forEach((option) => {
		option.result?.forEach((r) => {
			if (!r._) return

			if (!option.type || option.type === 'paragraph') {
				message += `<p>${escapeHtml(r._)}</p>`
				return
			} else if (option.type === 'code') {
				message += `<code>${escapeHtml(r._)}</code>`
				return
			}
		})
	})
	return message
}

const getAttachments = async (
	tcase: z.infer<typeof testCaseSchema>,
	basePath: string
): Promise<JUnitAttachment[]> => {
	const out = tcase['system-out'] || []
	const attachments: JUnitAttachment[] = []
	const promises: Array<{ file: Promise<Buffer>; path: string; filename: string }> = []

	for (const contents of out) {
		if (contents._) {
			const paths = extractAttachmentPaths(contents._)
			paths.forEach((p) =>
				promises.push({
					file: getFile(p, basePath),
					path: p,
					filename: basename(p),
				})
			)
		}
	}

	const files = await Promise.allSettled(promises.map((p) => p.file))
	files.forEach((p, i) => {
		const path = promises[i].path
		const filename = promises[i].filename
		if (p.status === 'fulfilled') {
			attachments.push({
				buffer: p.value,
				path,
				error: null,
				filename: filename,
			})
		} else {
			attachments.push({
				buffer: null,
				path,
				error: p.reason,
				filename: filename,
			})
		}
	})

	return attachments
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

const getFile = async (filePath: string, basePath: string): Promise<Buffer> => {
	try {
		const file = readFile(path.join(basePath, filePath))
		return file
	} catch (e) {
		if (
			e &&
			typeof e === 'object' &&
			'code' in e &&
			typeof e.code === 'string' &&
			e.code === 'ENOENT'
		) {
			throw new Error(`Attachment not found: "${filePath}"`)
		}
		throw e
	}
}
