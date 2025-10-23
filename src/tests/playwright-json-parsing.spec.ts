import { expect, test, describe } from 'vitest'
import { parsePlaywrightJson } from '../utils/result-upload/playwrightJsonParser'
import { readFile } from 'fs/promises'

const playwrightJsonBasePath = './src/tests/fixtures/playwright-json'

describe('Playwright JSON parsing', () => {
	test('Should parse comprehensive test JSON without exceptions', async () => {
		const jsonPath = `${playwrightJsonBasePath}/comprehensive-test.json`
		const jsonContent = await readFile(jsonPath, 'utf8')

		// This should not throw any exceptions
		const testcases = await parsePlaywrightJson(jsonContent, '')

		// Verify that we got the expected number of test cases
		expect(testcases).toHaveLength(12)

		// Verify we have all the different test result types
		const testStatuses = testcases.map((tc) => tc.status)
		expect(testStatuses).toContain('failed')
		expect(testStatuses).toContain('skipped')
		expect(testStatuses).toContain('passed')

		// Verify specific counts by status
		const statusCounts = testcases.reduce((acc, tc) => {
			acc[tc.status] = (acc[tc.status] || 0) + 1
			return acc
		}, {} as Record<string, number>)

		expect(statusCounts.failed).toBe(6) // 3 failures + 3 errors
		expect(statusCounts.skipped).toBe(4)
		expect(statusCounts.passed).toBe(2)

		// Verify that test cases have expected properties
		testcases.forEach((tc) => {
			expect(tc).toHaveProperty('name')
			expect(tc).toHaveProperty('folder')
			expect(tc).toHaveProperty('status')
			expect(tc).toHaveProperty('message')
			expect(tc).toHaveProperty('attachments')
			expect(Array.isArray(tc.attachments)).toBe(true)
		})
	})

	test('Should handle empty test suite', async () => {
		const jsonPath = `${playwrightJsonBasePath}/empty-tsuite.json`
		const jsonContent = await readFile(jsonPath, 'utf8')

		const testcases = await parsePlaywrightJson(jsonContent, '')

		// Should only have the one test from ui.cart.spec.ts, not the empty ui.contents.spec.ts
		expect(testcases).toHaveLength(1)
		expect(testcases[0].name).toContain('Test cart TEST-002')
	})

	test('Should use last result when there are retries', async () => {
		const jsonContent = JSON.stringify({
			suites: [
				{
					title: 'retry.spec.ts',
					specs: [
						{
							title: 'Flaky test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'failed',
											errors: [{ message: 'First attempt failed' }],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
										{
											status: 'passed',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 1,
											attachments: [],
										},
									],
									status: 'flaky',
								},
							],
						},
					],
					suites: [],
				},
			],
		})

		const testcases = await parsePlaywrightJson(jsonContent, '')
		expect(testcases).toHaveLength(1)

		// Should use the last result (passed on retry)
		expect(testcases[0].status).toBe('passed')
		expect(testcases[0].message).toContain('Test passed on 1 attempt')
	})

	test('Should handle nested suites correctly', async () => {
		const jsonContent = JSON.stringify({
			suites: [
				{
					title: 'parent.spec.ts',
					specs: [
						{
							title: 'Parent test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'passed',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
									],
									status: 'expected',
								},
							],
						},
					],
					suites: [
						{
							title: 'Nested Suite',
							specs: [
								{
									title: 'Nested test',
									tags: [],
									tests: [
										{
											annotations: [],
											expectedStatus: 'passed',
											projectName: 'chromium',
											results: [
												{
													status: 'passed',
													errors: [],
													stdout: [],
													stderr: [],
													retry: 0,
													attachments: [],
												},
											],
											status: 'expected',
										},
									],
								},
							],
							suites: [],
						},
					],
				},
			],
		})

		const testcases = await parsePlaywrightJson(jsonContent, '')
		expect(testcases).toHaveLength(2)

		// Verify folder is set to top-level suite title
		expect(testcases[0].folder).toBe('parent.spec.ts')
		expect(testcases[1].folder).toBe('parent.spec.ts')

		// Verify nested test has suite title as prefix
		expect(testcases[1].name).toContain('Nested Suite')
		expect(testcases[1].name).toContain('Nested test')
	})

	test('Should strip ANSI escape codes from errors and output', async () => {
		const jsonContent = JSON.stringify({
			suites: [
				{
					title: 'ansi.spec.ts',
					specs: [
						{
							title: 'Test with ANSI colors in error',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'failed',
											errors: [
												{
													message:
														'\x1b[31mError: Test failed\x1b[0m\n\x1b[90m  at Object.test\x1b[0m',
												},
											],
											stdout: [
												{
													text: '\x1b[32m✓\x1b[0m Test started\n\x1b[33mWarning:\x1b[0m Something happened',
												},
											],
											stderr: [
												{
													text: '\x1b[31mError output\x1b[0m\n\x1b[90mStack trace\x1b[0m',
												},
											],
											retry: 0,
											attachments: [],
										},
									],
									status: 'unexpected',
								},
							],
						},
					],
					suites: [],
				},
			],
		})

		const testcases = await parsePlaywrightJson(jsonContent, '')
		expect(testcases).toHaveLength(1)

		// Verify ANSI codes are stripped from message
		const message = testcases[0].message
		expect(message).not.toContain('\x1b[')
		expect(message).not.toContain('\x1b[31m')
		expect(message).not.toContain('\x1b[0m')

		// Verify actual content is preserved
		expect(message).toContain('Error: Test failed')
		expect(message).toContain('Test started')
		expect(message).toContain('Warning:')
		expect(message).toContain('Error output')
		expect(message).toContain('Stack trace')
	})

	test('Should map test status correctly', async () => {
		const jsonContent = JSON.stringify({
			suites: [
				{
					title: 'status.spec.ts',
					specs: [
						{
							title: 'Expected test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'passed',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
									],
									status: 'expected',
								},
							],
						},
						{
							title: 'Unexpected test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'failed',
											errors: [{ message: 'Test failed' }],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
									],
									status: 'unexpected',
								},
							],
						},
						{
							title: 'Flaky test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'passed',
									projectName: 'chromium',
									results: [
										{
											status: 'failed',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
										{
											status: 'passed',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 1,
											attachments: [],
										},
									],
									status: 'flaky',
								},
							],
						},
						{
							title: 'Skipped test',
							tags: [],
							tests: [
								{
									annotations: [],
									expectedStatus: 'skipped',
									projectName: 'chromium',
									results: [
										{
											status: 'skipped',
											errors: [],
											stdout: [],
											stderr: [],
											retry: 0,
											attachments: [],
										},
									],
									status: 'skipped',
								},
							],
						},
					],
					suites: [],
				},
			],
		})

		const testcases = await parsePlaywrightJson(jsonContent, '')
		expect(testcases).toHaveLength(4)

		expect(testcases[0].status).toBe('passed') // expected
		expect(testcases[1].status).toBe('failed') // unexpected
		expect(testcases[2].status).toBe('passed') // flaky (passed on retry)
		expect(testcases[3].status).toBe('skipped') // skipped
	})
})
