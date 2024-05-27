import escapeHtml from 'escape-html'
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
				testcase: z.array(
					z.object({
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
				),
			})
		),
	}),
})

export type JUnitResultType = 'failure' | 'error' | 'skipped' | 'success'

export interface JUnitTestCase extends JUnitResult {
	name?: string
	folder?: string
	logs?: string
}

export interface ParseResult {
	testcases: JUnitTestCase[]
}

export const parseJUnitXml = async (xmlString: string): Promise<ParseResult> => {
	const xmlData = await xml.parseStringPromise(xmlString, {
		explicitCharkey: true,
	})
	const validated = xmlSchema.parse(xmlData)

	const testcases: JUnitTestCase[] = []

	validated.testsuites.testsuite.forEach((suite) => {
		suite.testcase.forEach((tcase) => {
			const err = tcase['system-err'] || []
			const out = tcase['system-out'] || []
			const result: JUnitResult = (() => {
				if (tcase.error)
					return {
						type: 'error',
						message: getResultMessage(
							{ result: tcase.error },
							{ result: out, type: 'code' },
							{ result: err, type: 'code' }
						),
					}
				if (tcase.failure)
					return {
						type: 'failure',
						message: getResultMessage(
							{ result: tcase.failure },
							{ result: out, type: 'code' },
							{ result: err, type: 'code' }
						),
					}
				if (tcase.skipped)
					return {
						type: 'skipped',
						message: getResultMessage(
							{ result: tcase.skipped },
							{ result: out, type: 'code' },
							{ result: err, type: 'code' }
						),
					}
				return {
					type: 'success',
					message: getResultMessage({ result: out, type: 'code' }, { result: err, type: 'code' }),
				}
			})()

			testcases.push({
				folder: suite.$.name,
				name: tcase.$.name,
				...result,
			})
		})
	})

	return { testcases }
}

interface JUnitResult {
	type: JUnitResultType
	message?: string
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
