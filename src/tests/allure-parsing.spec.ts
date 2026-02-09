import { beforeAll, describe, expect, test, vi } from 'vitest'
import { parseAllureResults } from '../utils/result-upload/allureParser'

const allureParserBasePath = './src/tests/fixtures/allure/parser'

let testcases: Awaited<ReturnType<typeof parseAllureResults>>

describe('Allure results parsing', () => {
	beforeAll(async () => {
		testcases = await parseAllureResults(allureParserBasePath, allureParserBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
	})

	test('Should parse results directory and ignore non-result files', () => {
		expect(testcases).toHaveLength(9)

		const statuses = testcases.map((tc) => tc.status)
		expect(statuses).toContain('passed')
		expect(statuses).toContain('failed')
		expect(statuses).toContain('blocked')
		expect(statuses).toContain('skipped')
	})

	test('Should derive folders from labels with correct priority', () => {
		const suiteCase = testcases.find((tc) => tc.name.includes('Login happy path'))
		const parentCase = testcases.find((tc) => tc.name.includes('Payment error'))
		const featureCase = testcases.find((tc) => tc.name.includes('Broken flow'))
		const packageCase = testcases.find((tc) => tc.name.includes('Skipped TEST-003'))
		const noLabelCase = testcases.find((tc) => tc.name.includes('Unknown status test'))

		expect(suiteCase?.folder).toBe('SuiteA')
		expect(parentCase?.folder).toBe('ParentOnly')
		expect(featureCase?.folder).toBe('FeatureOnly')
		expect(packageCase?.folder).toBe('pkg.module')
		expect(noLabelCase?.folder).toBe('')
	})

	test('Should calculate durations from start/stop timestamps', () => {
		const suiteCase = testcases.find((tc) => tc.name.includes('Login happy path'))
		const parentCase = testcases.find((tc) => tc.name.includes('Payment error'))

		expect(suiteCase?.timeTaken).toBe(1500)
		expect(parentCase?.timeTaken).toBe(600)
	})

	test('Should map Allure statuses to QA Sphere statuses', () => {
		const brokenCase = testcases.find((tc) => tc.name.includes('Broken flow'))
		const unknownCase = testcases.find((tc) => tc.name.includes('Unknown status test'))

		expect(brokenCase?.status).toBe('blocked')
		expect(unknownCase?.status).toBe('passed')
	})

	test('Should build messages from status details', () => {
		const parentCase = testcases.find((tc) => tc.name.includes('Payment error'))
		const brokenCase = testcases.find((tc) => tc.name.includes('Broken flow'))
		const skippedCase = testcases.find((tc) => tc.name.includes('Skipped TEST-003'))

		expect(parentCase?.message).toContain('AssertionError')
		expect(parentCase?.message).toContain('Trace line 1')
		expect(brokenCase?.message).toContain('NullPointerException')
		expect(skippedCase?.message).toBe('')
	})

	test('Should resolve attachments from result directory', () => {
		const parentCase = testcases.find((tc) => tc.name.includes('Payment error'))
		expect(parentCase?.attachments).toHaveLength(1)
		expect(parentCase?.attachments[0].filename).toBe('failure-log.txt')
		expect(parentCase?.attachments[0].buffer).not.toBeNull()
	})

	test('Should handle missing or empty attachments arrays', () => {
		const suiteCase = testcases.find((tc) => tc.name.includes('Login happy path'))
		const brokenCase = testcases.find((tc) => tc.name.includes('Broken flow'))

		expect(suiteCase?.attachments).toHaveLength(0)
		expect(brokenCase?.attachments).toHaveLength(0)
	})

	test('Should keep marker when present in test name', () => {
		const suiteCase = testcases.find((tc) => tc.name.includes('Login happy path'))
		expect(suiteCase?.name).toContain('TEST-002')
	})

	test('Should extract markers from TMS links', () => {
		const tmsUrlCase = testcases.find((tc) => tc.name.includes('TMS URL linked test'))
		const tmsNameCase = testcases.find((tc) => tc.name.includes('TMS name linked test'))

		expect(tmsUrlCase?.name.startsWith('ALR-123:')).toBe(true)
		expect(tmsNameCase?.name.startsWith('TESTCASE-002:')).toBe(true)
	})

	test('Should keep parameterized results as separate entries', () => {
		const paramCases = testcases.filter((tc) => tc.name.startsWith('Param test'))
		expect(paramCases).toHaveLength(2)
	})

	test('Should handle empty results directory', async () => {
		const emptyResults = await parseAllureResults(
			'./src/tests/fixtures/allure/empty',
			'./src/tests/fixtures/allure/empty',
			{
				skipStdout: 'never',
				skipStderr: 'never',
			}
		)
		expect(emptyResults).toHaveLength(0)
	})

	test('Should skip malformed or invalid result files with warnings', async () => {
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

		const results = await parseAllureResults(allureParserBasePath, allureParserBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(results).toHaveLength(9)
		expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(2)

		const warnings = warnSpy.mock.calls.map((call) => String(call[0]))
		expect(warnings.some((w) => w.includes('malformed-result.json'))).toBe(true)
		expect(warnings.some((w) => w.includes('invalid-schema-result.json'))).toBe(true)

		warnSpy.mockRestore()
	})
})
