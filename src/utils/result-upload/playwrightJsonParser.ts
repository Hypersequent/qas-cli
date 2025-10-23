import z from 'zod'
import escapeHtml from 'escape-html'
import stripAnsi from 'strip-ansi'
import { Attachment, TestCaseResult } from './types'
import { Parser } from './ResultUploadCommandHandler'
import { ResultStatus } from '../../api/schemas'
import { getAttachments } from './utils'

// Schema definition as per https://github.com/microsoft/playwright/blob/main/packages/playwright/types/testReporter.d.ts

const expectedStatusSchema = z.enum(['passed', 'failed', 'interrupted', 'skipped', 'timedOut'])

const statusSchema = z.enum(['expected', 'unexpected', 'flaky', 'skipped'])

const reportErrorSchema = z.object({
	message: z.string(),
})

const stdioEntrySchema = z.union([z.object({ text: z.string() }), z.object({ buffer: z.string() })])

const annotationSchema = z.object({
	type: z.string(),
	description: z.string().optional(),
})

const attachmentSchema = z.object({
	name: z.string(),
	contentType: z.string(),
	path: z.string().optional(),
	body: z.string().optional(),
})

const resultSchema = z.object({
	status: expectedStatusSchema.optional(),
	errors: reportErrorSchema.array(),
	stdout: stdioEntrySchema.array(),
	stderr: stdioEntrySchema.array(),
	retry: z.number(),
	attachments: attachmentSchema.array().optional(),
	annotations: annotationSchema.array().optional(),
})

const testSchema = z.object({
	annotations: annotationSchema.array(),
	expectedStatus: expectedStatusSchema,
	projectName: z.string(),
	results: resultSchema.array(),
	status: statusSchema,
})

const specSchema = z.object({
	title: z.string(),
	tags: z.string().array(),
	tests: testSchema.array(),
})

interface Suite {
	title: string
	specs: z.infer<typeof specSchema>[]
	suites?: Suite[]
}

const suiteSchema: z.ZodType<Suite> = z.object({
	title: z.string(),
	specs: specSchema.array(),
	suites: z
		.lazy(() => suiteSchema)
		.array()
		.optional(),
})

const playwrightJsonSchema = z.object({
	suites: suiteSchema.array(),
})

export const parsePlaywrightJson: Parser = async (
	jsonString: string,
	attachmentBaseDirectory: string
): Promise<TestCaseResult[]> => {
	const jsonData = JSON.parse(jsonString)
	const validated = playwrightJsonSchema.parse(jsonData)
	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<Attachment[]>
	}> = []

	const processSuite = async (
		suite: z.infer<typeof suiteSchema>,
		topLevelSuite: string,
		titlePrefix: string
	) => {
		// Process specs in this suite
		for (const spec of suite.specs || []) {
			const test = spec.tests[0] // Why is tests an array?
			const result = test.results.at(-1) // There can be multiple results due to retries, use the last one

			if (!result) {
				return // Can this happen?
			}

			const numTestcases = testcases.push({
				name: `${titlePrefix}${spec.title}`,
				folder: topLevelSuite,
				status: mapPlaywrightStatus(test.status),
				message: buildMessage(result),
				attachments: [],
			})

			const attachmentPaths = []
			for (const out of result.attachments || []) {
				if (out.path) {
					attachmentPaths.push(out.path)
				}
			}
			attachmentsPromises.push({
				index: numTestcases - 1,
				// Attachment paths are absolute, but in tests we are using relative paths
				promise: getAttachments(
					attachmentPaths,
					attachmentPaths[0]?.startsWith('/') ? undefined : attachmentBaseDirectory
				),
			})
		}

		// Recursively process nested suites
		for (const nestedSuite of suite.suites || []) {
			await processSuite(nestedSuite, topLevelSuite, `${titlePrefix}${nestedSuite.title} › `)
		}
	}

	for (const suite of validated.suites) {
		// Top level suites in Playwright JSON are equivalent to test suites in JUnit XML, which are used
		// to populate TestCaseResult.folder property. The title of nested suites are used as prefix for
		// TestCaseResult.name for nested specs (similar to JUnit XML)
		await processSuite({ ...suite, title: '' }, suite.title, '')
	}

	const attachments = await Promise.all(attachmentsPromises.map((p) => p.promise))
	attachments.forEach((tcaseAttachment, i) => {
		const tcaseIndex = attachmentsPromises[i].index
		testcases[tcaseIndex].attachments = tcaseAttachment
	})

	return testcases
}

const mapPlaywrightStatus = (status: z.infer<typeof statusSchema>): ResultStatus => {
	switch (status) {
		case 'expected':
			return 'passed'
		case 'unexpected':
			return 'failed'
		case 'flaky':
			return 'passed' // Flaky means test passed but on retries
		case 'skipped':
			return 'skipped'
		default:
			return 'passed' // Default to passed
	}
}

const buildMessage = (result: z.infer<typeof resultSchema>) => {
	let message = ''

	if (result.retry) {
		message += `<p><b>Test passed in ${result.retry + 1} attempts</b></p>`
	}

	if (result.errors.length > 0) {
		message += '<h4>Errors:</h4>'
		result.errors.forEach((error) => {
			if (error.message) {
				const cleanMessage = stripAnsi(error.message)
				message += `<pre><code>${escapeHtml(cleanMessage)}</code></pre>`
			}
		})
	}

	if (result.stdout.length > 0) {
		message += '<h4>Output:</h4>'
		result.stdout.forEach((out) => {
			const content = 'text' in out ? out.text : out.buffer
			if (content) {
				const cleanContent = stripAnsi(content)
				message += `<pre><code>${escapeHtml(cleanContent)}</code></pre>`
			}
		})
	}

	if (result.stderr.length > 0) {
		message += '<h4>Errors (stderr):</h4>'
		result.stderr.forEach((err) => {
			const content = 'text' in err ? err.text : err.buffer
			if (content) {
				const cleanContent = stripAnsi(content)
				message += `<pre><code>${escapeHtml(cleanContent)}</code></pre>`
			}
		})
	}

	return message
}
