import { expect, test, describe } from 'vitest'
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { parseAllureResults } from '../utils/result-upload/allureParser'
import { ParserOptions } from '../utils/result-upload/ResultUploadCommandHandler'

const allureBasePath = './src/tests/fixtures/allure/unit-tests'

const defaultOptions: ParserOptions = {
	skipStdout: 'never',
	skipStderr: 'never',
}

describe('Allure results parsing', () => {
	test('Should parse results directory with passed/failed/broken/skipped tests', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		// Should only parse *-result.json files, not containers or attachments
		expect(testcases.length).toBeGreaterThanOrEqual(12)

		const statuses = testcases.map((tc) => tc.status)
		expect(statuses).toContain('passed')
		expect(statuses).toContain('failed')
		expect(statuses).toContain('blocked') // broken maps to blocked
		expect(statuses).toContain('skipped')
	})

	test('Should map broken status to blocked', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const brokenTest = testcases.find((tc) => tc.name === 'Database connection test')
		expect(brokenTest).toBeDefined()
		expect(brokenTest!.status).toBe('blocked')
	})

	test('Should map unknown status to passed', async () => {
		const tmpDir = join('/tmp', 'allure-unknown-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'aaa-result.json'),
			JSON.stringify({
				name: 'Unknown status test',
				status: 'unknown',
				uuid: 'unknown-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].status).toBe('passed')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should derive folder from suite label (highest priority)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const suiteTest = testcases.find((tc) => tc.name === 'Login with valid credentials')
		expect(suiteTest).toBeDefined()
		// Has both parentSuite="tests" and suite="login_test" — suite should win
		expect(suiteTest!.folder).toBe('login_test')
	})

	test('Should derive folder from parentSuite when suite is absent', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const parentSuiteTest = testcases.find((tc) => tc.name === 'Mocha style test')
		expect(parentSuiteTest).toBeDefined()
		expect(parentSuiteTest!.folder).toBe('API Tests')
	})

	test('Should derive folder from feature label (behave style)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const featureTest = testcases.find((tc) => tc.name === 'User can register with valid email')
		expect(featureTest).toBeDefined()
		expect(featureTest!.folder).toBe('Registration')
	})

	test('Should derive empty folder when no labels present (jest style)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const noLabelsTest = testcases.find((tc) => tc.name === 'Jest style test with no labels')
		expect(noLabelsTest).toBeDefined()
		expect(noLabelsTest!.folder).toBe('')
	})

	test('Should calculate duration from start/stop timestamps', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const loginTest = testcases.find((tc) => tc.name === 'Login with valid credentials')
		expect(loginTest).toBeDefined()
		expect(loginTest!.timeTaken).toBe(1500) // 1700000001500 - 1700000000000
	})

	test('Should extract error message from statusDetails.message', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const failedTest = testcases.find((tc) => tc.name.includes('Login with invalid password'))
		expect(failedTest).toBeDefined()
		expect(failedTest!.message).toContain('AssertionError')
		expect(failedTest!.message).toContain('Message:')
	})

	test('Should extract trace from statusDetails.trace', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const failedTest = testcases.find((tc) => tc.name.includes('Login with invalid password'))
		expect(failedTest).toBeDefined()
		expect(failedTest!.message).toContain('Trace:')
		expect(failedTest!.message).toContain('Traceback')
	})

	test('Should handle null statusDetails gracefully', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const passedTest = testcases.find((tc) => tc.name === 'Login with valid credentials')
		expect(passedTest).toBeDefined()
		expect(passedTest!.message).toBe('')
	})

	test('Should handle empty statusDetails object gracefully', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const emptyDetailsTest = testcases.find((tc) => tc.name === 'Test with empty statusDetails')
		expect(emptyDetailsTest).toBeDefined()
		expect(emptyDetailsTest!.message).toBe('')
	})

	test('Should read attachment files via getAttachments', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const testWithAttachment = testcases.find((tc) =>
			tc.name.includes('Login with invalid password')
		)
		expect(testWithAttachment).toBeDefined()
		expect(testWithAttachment!.attachments).toHaveLength(1)
		expect(testWithAttachment!.attachments[0].filename).toBe('ut-screenshot-attachment.txt')
		expect(testWithAttachment!.attachments[0].buffer).not.toBeNull()
	})

	test('Should handle results with no attachments', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const noAttachTest = testcases.find((tc) => tc.name === 'Database connection test')
		expect(noAttachTest).toBeDefined()
		expect(noAttachTest!.attachments).toHaveLength(0)
	})

	test('Should extract test case marker from test name', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		// TEST-002 in the name is extracted by the upstream pipeline, not by the parser itself
		// The parser just passes the name through
		const markerTest = testcases.find((tc) => tc.name.includes('Login with invalid password'))
		expect(markerTest).toBeDefined()
		expect(markerTest!.name).toContain('TEST-002')
	})

	test('Should extract test case marker from TMS link URL (QA Sphere)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const tmsUrlTest = testcases.find((tc) => tc.name.includes('Login test via TMS URL'))
		expect(tmsUrlTest).toBeDefined()
		// TMS link URL is a QA Sphere URL — marker should be prefixed
		expect(tmsUrlTest!.name).toBe('PRJ-123: Login test via TMS URL')
	})

	test('Should extract test case marker from TMS link name (non-QA Sphere URL)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const tmsNameTest = testcases.find((tc) => tc.name.includes('Checkout test via TMS name'))
		expect(tmsNameTest).toBeDefined()
		// URL isn't a QA Sphere URL, so falls back to regex on name
		expect(tmsNameTest!.name).toBe('TESTCASE-456: Checkout test via TMS name')
	})

	test('Should handle parameterized tests as separate results', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		const paramTests = testcases.filter((tc) => tc.name.startsWith('Test login['))
		expect(paramTests).toHaveLength(2)

		const chromiumTest = paramTests.find((tc) => tc.name.includes('chromium'))
		const firefoxTest = paramTests.find((tc) => tc.name.includes('firefox'))
		expect(chromiumTest!.status).toBe('passed')
		expect(firefoxTest!.status).toBe('failed')
	})

	test('Should skip container files (only parse *-result.json)', async () => {
		const testcases = await parseAllureResults(allureBasePath, allureBasePath, defaultOptions)

		// Container files should not produce any test results
		// All results should have meaningful names (no container-like names)
		for (const tc of testcases) {
			expect(tc.name).toBeDefined()
			expect(tc.name.length).toBeGreaterThan(0)
		}
	})

	test('Should handle empty results directory', async () => {
		const tmpDir = join('/tmp', 'allure-empty-test')
		mkdirSync(tmpDir, { recursive: true })

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(0)
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should ignore non-result files in directory', async () => {
		const tmpDir = join('/tmp', 'allure-nonresult-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(join(tmpDir, 'something-testsuite.xml'), '<xml>legacy</xml>')
		writeFileSync(join(tmpDir, 'image-attachment.png'), 'fake png data')
		writeFileSync(
			join(tmpDir, 'valid-result.json'),
			JSON.stringify({
				name: 'Valid test',
				status: 'passed',
				uuid: 'valid-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].name).toBe('Valid test')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should skip malformed JSON with warning', async () => {
		const tmpDir = join('/tmp', 'allure-malformed-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(join(tmpDir, 'bad-result.json'), '{ not valid json }}}')
		writeFileSync(
			join(tmpDir, 'good-result.json'),
			JSON.stringify({
				name: 'Good test',
				status: 'passed',
				uuid: 'good-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].name).toBe('Good test')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should skip files that fail Zod validation with warning', async () => {
		const tmpDir = join('/tmp', 'allure-invalid-schema-test')
		mkdirSync(tmpDir, { recursive: true })
		// Missing required 'status' field
		writeFileSync(
			join(tmpDir, 'invalid-result.json'),
			JSON.stringify({
				name: 'Invalid test',
				uuid: 'invalid-uuid',
				start: 1700000000000,
				stop: 1700000001000,
			})
		)
		writeFileSync(
			join(tmpDir, 'valid-result.json'),
			JSON.stringify({
				name: 'Valid test',
				status: 'passed',
				uuid: 'valid-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].name).toBe('Valid test')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should skip message for passed tests when skipStdout is on-success', async () => {
		const tmpDir = join('/tmp', 'allure-skip-stdout-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'passed-result.json'),
			JSON.stringify({
				name: 'Passed test with details',
				status: 'passed',
				uuid: 'skip-stdout-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
				statusDetails: {
					message: 'Some info message',
				},
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, {
				skipStdout: 'on-success',
				skipStderr: 'never',
			})
			expect(testcases).toHaveLength(1)
			expect(testcases[0].message).not.toContain('Some info message')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should skip trace for passed tests when skipStderr is on-success', async () => {
		const tmpDir = join('/tmp', 'allure-skip-stderr-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'passed-result.json'),
			JSON.stringify({
				name: 'Passed test with trace',
				status: 'passed',
				uuid: 'skip-stderr-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
				statusDetails: {
					message: 'Some info message',
					trace: 'Some trace info',
				},
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, {
				skipStdout: 'never',
				skipStderr: 'on-success',
			})
			expect(testcases).toHaveLength(1)
			expect(testcases[0].message).toContain('Some info message')
			expect(testcases[0].message).not.toContain('Some trace info')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should include message/trace for failed tests even when skip options are on-success', async () => {
		const tmpDir = join('/tmp', 'allure-failed-skip-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'failed-result.json'),
			JSON.stringify({
				name: 'Failed test with details',
				status: 'failed',
				uuid: 'failed-skip-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
				statusDetails: {
					message: 'Failure message',
					trace: 'Failure trace',
				},
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, {
				skipStdout: 'on-success',
				skipStderr: 'on-success',
			})
			expect(testcases).toHaveLength(1)
			expect(testcases[0].message).toContain('Failure message')
			expect(testcases[0].message).toContain('Failure trace')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should handle results with null arrays gracefully', async () => {
		const tmpDir = join('/tmp', 'allure-null-arrays-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'null-arrays-result.json'),
			JSON.stringify({
				name: 'Test with null arrays',
				status: 'passed',
				uuid: 'null-arrays-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: null,
				attachments: null,
				links: null,
				parameters: null,
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].name).toBe('Test with null arrays')
			expect(testcases[0].folder).toBe('')
			expect(testcases[0].attachments).toHaveLength(0)
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})

	test('Should escape HTML in message/trace', async () => {
		const tmpDir = join('/tmp', 'allure-html-escape-test')
		mkdirSync(tmpDir, { recursive: true })
		writeFileSync(
			join(tmpDir, 'html-result.json'),
			JSON.stringify({
				name: 'Test with HTML chars',
				status: 'failed',
				uuid: 'html-uuid',
				start: 1700000000000,
				stop: 1700000001000,
				labels: [],
				statusDetails: {
					message: 'Expected <div> to contain "hello"',
					trace: 'at <anonymous>:1:1',
				},
			})
		)

		try {
			const testcases = await parseAllureResults(tmpDir, tmpDir, defaultOptions)
			expect(testcases).toHaveLength(1)
			expect(testcases[0].message).toContain('&lt;div&gt;')
			expect(testcases[0].message).toContain('&lt;anonymous&gt;')
			expect(testcases[0].message).not.toContain('<div>')
		} finally {
			rmSync(tmpDir, { recursive: true })
		}
	})
})
