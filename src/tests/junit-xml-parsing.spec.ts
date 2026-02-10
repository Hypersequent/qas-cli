import { expect, test, describe } from 'vitest'
import { readFile } from 'node:fs/promises'
import { parseJUnitXml } from '../utils/result-upload/junitXmlParser'

const xmlBasePath = './src/tests/fixtures/junit-xml'

describe('Junit XML parsing', () => {
	test('Should parse comprehensive test XML without exceptions', async () => {
		const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		// This should not throw any exceptions
		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
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
		const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
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
		const xmlPath = `${xmlBasePath}/empty-system-err.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
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
		const xmlPath = `${xmlBasePath}/jest-failure-type-missing.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
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

	test('Should use classname as folder for pytest-style JUnit XML', async () => {
		const xmlPath = `${xmlBasePath}/pytest-style.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(5)

		// pytest puts all tests in a single suite named "pytest", but classname
		// provides meaningful grouping like "tests.login_test.TestLogin"
		const loginTests = testcases.filter((tc) => tc.folder === 'tests.login_test.TestLogin')
		expect(loginTests).toHaveLength(2)

		const checkoutTests = testcases.filter((tc) => tc.folder === 'tests.checkout_test.TestCheckout')
		expect(checkoutTests).toHaveLength(1)

		const inventoryTests = testcases.filter(
			(tc) => tc.folder === 'tests.inventory_test.TestInventory'
		)
		expect(inventoryTests).toHaveLength(2)

		// Verify the failed test has proper status
		const failedTest = testcases.find((tc) => tc.status === 'failed')
		expect(failedTest).toBeDefined()
		expect(failedTest?.folder).toBe('tests.inventory_test.TestInventory')
		expect(failedTest?.message).toContain('AssertionError')
	})

	test('Should fall back to suite name when classname is absent', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="my-suite">
    <testcase name="test one" time="1.0">
    </testcase>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].folder).toBe('my-suite')
	})

	test('Should extract attachments from failure/error message attributes (WebDriverIO style)', async () => {
		const xmlPath = `${xmlBasePath}/webdriverio-real.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
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
		const xmlPath = `${xmlBasePath}/empty-system-err.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		// Should include stdout content
		expect(testcases[0].message).toContain('ViewManager initialized')
	})

	test('Should skip stdout for passed tests when skipStdout is set to "on-success"', async () => {
		const xmlPath = `${xmlBasePath}/empty-system-err.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath, {
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
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Test with stderr" time="10.5">
      <system-out>stdout content</system-out>
      <system-err>stderr content</system-err>
    </testcase>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
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
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Failed test with output" time="0">
      <failure message="Test failed">Failure details</failure>
      <system-out>stdout from failed test</system-out>
      <system-err>stderr from failed test</system-err>
    </testcase>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
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
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Test Suite">
  <testsuite name="Sample Suite">
    <testcase name="Passed test with output" time="">
      <system-out>stdout content</system-out>
      <system-err>stderr content</system-err>
    </testcase>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'on-success',
			skipStderr: 'on-success',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].status).toBe('passed')
		expect(testcases[0].timeTaken).toBe(null)
		// Should not include stdout or stderr for passed tests
		expect(testcases[0].message).toBe('')
	})

	test('Should parse <testsuites> without attributes', async () => {
		const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="com.example.MyTest" tests="1" time="0.5">
    <testcase classname="com.example.MyTest" name="test1" time="0.5"/>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].name).toBe('test1')
		expect(testcases[0].folder).toBe('com.example.MyTest')
		expect(testcases[0].status).toBe('passed')
	})

	test('Should parse <testsuite> without attributes inside <testsuites>', async () => {
		const xml = `<?xml version="1.0"?>
<testsuites>
  <testsuite>
    <testcase classname="com.example.MyTest" name="test1" time="0.3"/>
  </testsuite>
</testsuites>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].name).toBe('test1')
		expect(testcases[0].folder).toBe('com.example.MyTest')
	})

	test('Should accept bare <testsuite> as root element', async () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite hostname="host" failures="0" tests="2" name="com.example.MathUtilsTest"
           time="0.001" errors="0" timestamp="2026-02-10T12:24:12 UTC" skipped="0">
  <testcase classname="com.example.MathUtilsTest" name="testAddition" time="0.001"/>
  <testcase classname="com.example.MathUtilsTest" name="testDivisionByZero" time="0.000">
    <failure message="Expected exception">java.lang.ArithmeticException</failure>
  </testcase>
</testsuite>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(2)
		expect(testcases[0].name).toBe('testAddition')
		expect(testcases[0].folder).toBe('com.example.MathUtilsTest')
		expect(testcases[0].status).toBe('passed')
		expect(testcases[0].timeTaken).toBe(1)

		expect(testcases[1].name).toBe('testDivisionByZero')
		expect(testcases[1].status).toBe('failed')
		expect(testcases[1].message).toContain('ArithmeticException')
	})

	test('Should accept bare <testsuite> without attributes as root element', async () => {
		const xml = `<?xml version="1.0"?>
<testsuite>
  <testcase name="test1" time="0.1"/>
</testsuite>`

		const testcases = await parseJUnitXml(xml, xmlBasePath, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(1)
		expect(testcases[0].name).toBe('test1')
		expect(testcases[0].folder).toBe('')
	})
})
