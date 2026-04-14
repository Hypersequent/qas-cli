import z from 'zod'
import escapeHtml from 'escape-html'
import stripAnsi from 'strip-ansi'
import { Attachment, ParseResult, TestCaseResult } from '../types'
import { Parser, ParserOptions } from '../ResultUploadCommandHandler'
import { ResultStatus } from '../../../api/schemas'
import { parseTCaseUrl } from '../../misc'
import { formatMarker, getParsedMarkerFromText } from '../MarkerParser'
import { getAttachments } from '../utils'
import type { TestCaseMarker } from '../types'

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
	duration: z.number(),
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
	errors: reportErrorSchema.array().optional(),
})

export const parsePlaywrightJson: Parser = async (
	jsonString: string,
	attachmentBaseDirectory: string,
	options: ParserOptions
): Promise<ParseResult> => {
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

			const markers = getAllTCaseMarkersFromAnnotations(test.annotations) // What about result.annotations?
			const status = mapPlaywrightStatus(test.status)
			const message = buildMessage(result, status, options)
			const baseName = `${titlePrefix}${spec.title}`
			const fallbackMarker = getParsedMarkerFromText(spec.title)

			const attachmentPaths: string[] = []
			for (const out of result.attachments || []) {
				if (out.path) {
					attachmentPaths.push(out.path)
				}
			}
			const attachmentPromise = getAttachments(
				attachmentPaths,
				attachmentPaths[0]?.startsWith('/') ? undefined : attachmentBaseDirectory
			)

			// Fan out: one TestCaseResult per unique annotation, or one result using the spec title marker.
			const uniqueMarkers = dedupeMarkers(markers)
			const resultsToCreate =
				uniqueMarkers.length > 0
					? uniqueMarkers.map((marker) => ({
							name: `${formatMarker(marker.projectCode, marker.seq)}: ${baseName}`,
							marker,
							markerResolution: 'resolved' as const,
						}))
					: [
							{
								name: baseName,
								marker: fallbackMarker ?? null,
								markerResolution: fallbackMarker
									? ('resolved' as const)
									: ('resolved-none' as const),
							},
						]

			for (const { name, marker, markerResolution } of resultsToCreate) {
				const numTestcases = testcases.push({
					name,
					marker,
					markerResolution,
					folder: topLevelSuite,
					status,
					message,
					timeTaken: result.duration,
					attachments: [],
				})
				attachmentsPromises.push({
					index: numTestcases - 1,
					promise: attachmentPromise,
				})
			}
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
		// Clone to avoid affecting other test cases if any downstream code mutates the array
		testcases[tcaseIndex].attachments = [...tcaseAttachment]
	})

	// Build runFailureLogs from top-level errors
	const runFailureLogParts: string[] = []
	for (const error of validated.errors ?? []) {
		const cleanMessage = stripAnsi(error.message)
		runFailureLogParts.push(`<pre><code>${escapeHtml(cleanMessage)}</code></pre>`)
	}

	return { testCaseResults: testcases, runFailureLogs: runFailureLogParts.join('') }
}

const getAllTCaseMarkersFromAnnotations = (annotations: Annotation[]): TestCaseMarker[] => {
	const markers: TestCaseMarker[] = []
	for (const annotation of annotations) {
		if (annotation.type.toLowerCase().includes('test case') && annotation.description) {
			const res = parseTCaseUrl(annotation.description)
			if (res) {
				markers.push({
					projectCode: res.project,
					seq: res.tcaseSeq,
				})
			}
		}
	}
	return markers
}

const dedupeMarkers = (markers: TestCaseMarker[]): TestCaseMarker[] => {
	const uniqueMarkers = new Map<string, TestCaseMarker>()
	for (const marker of markers) {
		uniqueMarkers.set(`${marker.projectCode.toLowerCase()}-${marker.seq}`, marker)
	}
	return Array.from(uniqueMarkers.values())
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
	const parts: string[] = []

	if (result.retry) {
		parts.push(`<p><b>Test passed in ${result.retry + 1} attempts</b></p>`)
	}

	if (result.errors.length > 0) {
		parts.push('<h4>Errors:</h4>')
		result.errors.forEach((error) => {
			if (error.message) {
				const cleanMessage = stripAnsi(error.message)
				parts.push(`<pre><code>${escapeHtml(cleanMessage)}</code></pre>`)
			}
		})
	}

	// Conditionally include stdout based on status and options
	const includeStdout = !(status === 'passed' && options.skipStdout === 'on-success')
	if (includeStdout && result.stdout.length > 0) {
		parts.push('<h4>Output (stdout):</h4>')
		result.stdout.forEach((out) => {
			const content = 'text' in out ? out.text : out.buffer
			if (content) {
				const cleanContent = stripAnsi(content)
				parts.push(`<pre><code>${escapeHtml(cleanContent)}</code></pre>`)
			}
		})
	}

	// Conditionally include stderr based on status and options
	const includeStderr = !(status === 'passed' && options.skipStderr === 'on-success')
	if (includeStderr && result.stderr.length > 0) {
		parts.push('<h4>Output (stderr):</h4>')
		result.stderr.forEach((err) => {
			const content = 'text' in err ? err.text : err.buffer
			if (content) {
				const cleanContent = stripAnsi(content)
				parts.push(`<pre><code>${escapeHtml(cleanContent)}</code></pre>`)
			}
		})
	}

	return parts.join('')
}
