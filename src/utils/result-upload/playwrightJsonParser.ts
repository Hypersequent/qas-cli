import chalk from 'chalk'
import escapeHtml from 'escape-html'
import { readFileSync } from 'node:fs'
import stripAnsi from 'strip-ansi'
import z from 'zod'
import { Attachment, TestCaseResult } from './types'
import { Parser, ParserOptions } from './ResultUploadCommandHandler'
import { ResultStatus } from '../../api/schemas'
import { getTCaseMarker, parseTCaseUrl } from '../misc'
import { getAttachments } from './utils'

// Schema definition as per https://github.com/microsoft/playwright/blob/main/packages/playwright/types/testReporter.d.ts

const expectedStatusSchema = z.enum(['passed', 'failed', 'interrupted', 'skipped', 'timedOut'])

const statusSchema = z.enum(['expected', 'unexpected', 'flaky', 'skipped'])
type Status = z.infer<typeof statusSchema>

const reportErrorSchema = z.object({
	message: z.string(),
})

const stdioEntrySchema = z.union([z.object({ text: z.string() }), z.object({ buffer: z.string() })])

const annotationSchema = z.object({
	type: z.string(),
	description: z.string().optional(),
})
type Annotation = z.infer<typeof annotationSchema>

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
type Result = z.infer<typeof resultSchema>

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
type Spec = z.infer<typeof specSchema>

interface Suite {
	title: string
	specs: Spec[]
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

export const printPlaywrightMissingMarkerGuidance = (
	projectCode: string,
	exampleTestName = 'your test name'
) => {
	console.error(`
${chalk.yellow('To fix this issue, choose one of the following options:')}

  ${chalk.bold('Option 1: Use Test Annotations (Recommended)')}
  Add a "test case" annotation to your Playwright test with the QA Sphere test case URL:

  ${chalk.green(`test('${exampleTestName}', {
    annotation: {
      type: 'test case',
      description: 'https://your-qas-instance.com/project/${projectCode}/tcase/123'
    }
  }, async ({ page }) => {
    // your test code
  });`)}

  ${chalk.dim('Note: The "type" field is case-insensitive')}

  ${chalk.bold('Option 2: Include Test Case Marker in Name')}
  Rename your test to include the test case marker:

  Format: ${chalk.green(`${projectCode}-<sequence>`)}, ${chalk.dim(
		'where <sequence> is the test case number (minimum 3 digits, zero-padded if needed)'
	)}
  Example: ${chalk.green(`${projectCode}-002: ${exampleTestName}`)}
           ${chalk.green(`${exampleTestName}: ${projectCode}-1312`)}
`)
}

export const parsePlaywrightJson: Parser = async (
	filePath: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<TestCaseResult[]> => {
	const jsonString = readFileSync(filePath).toString()
	const jsonData = JSON.parse(jsonString)
	const validated = playwrightJsonSchema.parse(jsonData)
	const testcases: TestCaseResult[] = []
	const attachmentsPromises: Array<{
		index: number
		promise: Promise<Attachment[]>
	}> = []

	const processSuite = async (suite: Suite, topLevelSuite: string, titlePrefix: string) => {
		// Process specs in this suite
		for (const spec of suite.specs || []) {
			const test = spec.tests[0] // Why is tests an array?
			const result = test.results.at(-1) // There can be multiple results due to retries, use the last one

			if (!result) {
				return // Can this happen?
			}

			const markerFromAnnotations = getTCaseMarkerFromAnnotations(test.annotations) // What about result.annotations?
			const status = mapPlaywrightStatus(test.status)
			const numTestcases = testcases.push({
				// Use markerFromAnnotations as name prefix, so that it takes precedence over any
				// other marker present. Prefixing it to name also helps in detectProjectCode
				name: markerFromAnnotations
					? `${markerFromAnnotations}: ${titlePrefix}${spec.title}`
					: `${titlePrefix}${spec.title}`,
				folder: topLevelSuite,
				status,
				message: buildMessage(result, status, options),
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

const getTCaseMarkerFromAnnotations = (annotations: Annotation[]) => {
	for (const annotation of annotations) {
		if (annotation.type.toLowerCase().includes('test case') && annotation.description) {
			const res = parseTCaseUrl(annotation.description)
			if (res) {
				return getTCaseMarker(res.project, res.tcaseSeq)
			}
		}
	}
}

const mapPlaywrightStatus = (status: Status): ResultStatus => {
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

const buildMessage = (result: Result, status: ResultStatus, options: ParserOptions) => {
	let message = ''

	if (result.retry) {
		message += `<p><strong>Test passed in ${result.retry + 1} attempts</strong></p>`
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

	// Conditionally include stdout based on status and options
	const includeStdout = !(status === 'passed' && options.skipStdout === 'on-success')
	if (includeStdout && result.stdout.length > 0) {
		message += '<h4>Output:</h4>'
		result.stdout.forEach((out) => {
			const content = 'text' in out ? out.text : out.buffer
			if (content) {
				const cleanContent = stripAnsi(content)
				message += `<pre><code>${escapeHtml(cleanContent)}</code></pre>`
			}
		})
	}

	// Conditionally include stderr based on status and options
	const includeStderr = !(status === 'passed' && options.skipStderr === 'on-success')
	if (includeStderr && result.stderr.length > 0) {
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
