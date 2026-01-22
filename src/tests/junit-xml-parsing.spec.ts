import { expect, test, describe, afterEach } from 'vitest'
import { parseJUnitXml } from '../utils/result-upload/junitXmlParser'
import { createTempFile, deleteTempFile } from './utils'

const xmlBasePath = './src/tests/fixtures/junit-xml'

describe('Junit XML parsing', () => {
	let tempXmlFile: string | null = null

	afterEach(() => {
		if (tempXmlFile) {
			deleteTempFile(tempXmlFile)
			tempXmlFile = null
		}
	})

	test('Should parse comprehensive test XML without exceptions', async () => {
		// This should not throw any exceptions
		const testcases = await parseJUnitXml(`${xmlBasePath}/comprehensive-test.xml`, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		// Verify that we got the expected number of test cases
		expect(testcases).toHaveLength(12)

		// Verify we have all the different test result types
		const testTypes = testcases.map((tc) => tc.status)
		expect(testTypes).toContain('failed')
		expect(testTypes).toContain('blocked')
		expect(testTypes).toContain('skipped')
		expect(testTypes).toContain('passed')

		// Verify specific counts by type
		const typeCounts = testcases.reduce(
			(acc, tc) => {
				acc[tc.status] = (acc[tc.status] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		expect(typeCounts.failed).toBe(3)
		expect(typeCounts.blocked).toBe(3)
		expect(typeCounts.skipped).toBe(4)
		expect(typeCounts.passed).toBe(2)

		// Verify that test cases have expected properties
		testcases.forEach((tc) => {
			expect(tc).toHaveProperty('name')
			expect(tc).toHaveProperty('folder')
			expect(tc).toHaveProperty('status')
			expect(tc).toHaveProperty('message')
			expect(tc).toHaveProperty('attachments')
			expect(tc).toHaveProperty('timeTaken')
			expect(Array.isArray(tc.attachments)).toBe(true)
		})
	})

	test('Should handle all failure/error/skipped element variations', async () => {
		const testcases = await parseJUnitXml(`${xmlBasePath}/comprehensive-test.xml`, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		// Test specific scenarios from our comprehensive test
		const failureTests = testcases.filter((tc) => tc.status === 'failed')
		const errorTests = testcases.filter((tc) => tc.status === 'blocked')
		const skippedTests = testcases.filter((tc) => tc.status === 'skipped')

		// Verify we have the expected failure scenarios
		expect(failureTests.some((tc) => tc.name.includes('only type'))).toBe(true)
		expect(failureTests.some((tc) => tc.name.includes('type and message'))).toBe(true)
		expect(failureTests.some((tc) => tc.name.includes('type, message and text content'))).toBe(true)

		// Verify we have the expected error scenarios
		expect(errorTests.some((tc) => tc.name.includes('only type'))).toBe(true)
		expect(errorTests.some((tc) => tc.name.includes('type and text content'))).toBe(true)
		expect(errorTests.some((tc) => tc.name.includes('type, message and text content'))).toBe(true)

		// Verify we have the expected skipped scenarios
		expect(skippedTests.some((tc) => tc.name.includes('Empty skipped'))).toBe(true)
		expect(skippedTests.some((tc) => tc.name.includes('only message'))).toBe(true)
		expect(skippedTests.some((tc) => tc.name.includes('only text content'))).toBe(true)
		expect(skippedTests.some((tc) => tc.name.includes('message and text content'))).toBe(true)
	})

	test('Should handle empty <system-err> and similar empty tags', async () => {
		const testcases = await parseJUnitXml(`${xmlBasePath}/empty-system-err.xml`, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
		expect(testcases).toHaveLength(1)

		// Should parse as success (no failure/error/skipped present)
		expect(testcases[0].status).toBe('passed')

		// Message should include system-out content but not fail on empty system-err
		expect(testcases[0].message).toContain('ViewManager initialized')
	})

	test('Should handle Jest failure without type attribute', async () => {
		const testcases = await parseJUnitXml(
			`${xmlBasePath}/jest-failure-type-missing.xml`,
			xmlBasePath,
			{
				skipStdout: 'never',
				skipStderr: 'never',
			}
		)
		expect(testcases).toHaveLength(3)

		// Verify test result types
		const typeCounts = testcases.reduce(
			(acc, tc) => {
				acc[tc.status] = (acc[tc.status] || 0) + 1
				return acc
			},
			{} as Record<string, number>
		)

		expect(typeCounts.passed).toBe(2)
		expect(typeCounts.failed).toBe(1)

		// Find the failure test case
		const failedTest = testcases.find((tc) => tc.status === 'failed')
		expect(failedTest).toBeDefined()
		expect(failedTest?.name).toContain('subtracts two numbers correctly')
		expect(failedTest?.message).toContain('expect(received).toBe(expected)')
	})

	test('Should extract attachments from failure/error message attributes (WebDriverIO style)', async () => {
		const testcases = await parseJUnitXml(`${xmlBasePath}/webdriverio-real.xml`, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
		expect(testcases).toHaveLength(4)

		// Find the test case BD-055 which has a failure element with attachment in the message attribute
		const bd055 = testcases.find((tc) => tc.name.includes('BD-055'))
		expect(bd055).toBeDefined()
		expect(bd055?.status).toBe('failed')

		// This test should have an attachment extracted from the failure message attribute
		// This is the WebDriverIO style where attachments are embedded in the failure message
		expect(bd055?.attachments.length).toBeGreaterThan(0)
		expect(bd055?.attachments[0].filename).toContain('BD_055')
		expect(bd055?.attachments[0].filename).toContain('.png')
	})

	test('Should include stdout/stderr when skipStdout and skipStderr are set to "never"', async () => {
		const testcases = await parseJUnitXml(`${xmlBasePath}/empty-system-err.xml`, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		// Should include stdout content
		expect(testcases[0].message).toContain('ViewManager initialized')
	})

	test('Should skip stdout for passed tests when skipStdout is set to "on-success"', async () => {
		const testcases = await parseJUnitXml(`${xmlBasePath}/empty-system-err.xml`, xmlBasePath, {
			skipStdout: 'on-success',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		// Should NOT include stdout content for passed tests
		expect(testcases[0].message).not.toContain('ViewManager initialized')
		expect(testcases[0].message).toBe('')
	})

	test('Should skip stderr for passed tests when skipStderr is set to "on-success"', async () => {
		tempXmlFile = createTempFile(
			`<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Test with stderr" time="10.5">
      <system-out>stdout content</system-out>
      <system-err>stderr content</system-err>
    </testcase>
  </testsuite>
</testsuites>`,
			'xml'
		)

		const testcases = await parseJUnitXml(tempXmlFile, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'on-success',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		expect(testcases[0].timeTaken).toBe(10500)
		// Should include stdout but not stderr for passed tests
		expect(testcases[0].message).toContain('stdout content')
		expect(testcases[0].message).not.toContain('stderr content')
	})

	test('Should include stdout/stderr for failed tests even when skip options are set to "on-success"', async () => {
		tempXmlFile = createTempFile(
			`<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Failed test with output" time="0">
      <failure message="Test failed">Failure details</failure>
      <system-out>stdout from failed test</system-out>
      <system-err>stderr from failed test</system-err>
    </testcase>
  </testsuite>
</testsuites>`,
			'xml'
		)

		const testcases = await parseJUnitXml(tempXmlFile, xmlBasePath, {
			skipStdout: 'on-success',
			skipStderr: 'on-success',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('failed')
		expect(testcases[0].timeTaken).toBe(0)
		// Should include both stdout and stderr for failed tests
		expect(testcases[0].message).toContain('Failure details')
		expect(testcases[0].message).toContain('stdout from failed test')
		expect(testcases[0].message).toContain('stderr from failed test')
	})

	test('Should skip both stdout and stderr for passed tests when both skip options are set to "on-success"', async () => {
		tempXmlFile = createTempFile(
			`<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Passed test with output" time="">
      <system-out>stdout content</system-out>
      <system-err>stderr content</system-err>
    </testcase>
  </testsuite>
</testsuites>`,
			'xml'
		)

		const testcases = await parseJUnitXml(tempXmlFile, xmlBasePath, {
			skipStdout: 'on-success',
			skipStderr: 'on-success',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		expect(testcases[0].timeTaken).toBe(null)
		// Should not include stdout or stderr for passed tests
		expect(testcases[0].message).toBe('')
	})
})
