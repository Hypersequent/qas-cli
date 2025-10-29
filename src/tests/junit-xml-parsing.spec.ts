import { expect, test, describe } from 'vitest'
import { parseJUnitXml } from '../utils/result-upload/junitXmlParser'
import { readFile } from 'fs/promises'

const xmlBasePath = './src/tests/fixtures/junit-xml'

describe('Junit XML parsing', () => {
	test('Should parse comprehensive test XML without exceptions', async () => {
		const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		// This should not throw any exceptions
		const testcases = await parseJUnitXml(xmlContent, xmlBasePath)

		// Verify that we got the expected number of test cases
		expect(testcases).toHaveLength(12)

		// Verify we have all the different test result types
		const testTypes = testcases.map((tc) => tc.status)
		expect(testTypes).toContain('failed')
		expect(testTypes).toContain('blocked')
		expect(testTypes).toContain('skipped')
		expect(testTypes).toContain('passed')

		// Verify specific counts by type
		const typeCounts = testcases.reduce((acc, tc) => {
			acc[tc.status] = (acc[tc.status] || 0) + 1
			return acc
		}, {} as Record<string, number>)

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
			expect(Array.isArray(tc.attachments)).toBe(true)
		})
	})

	test('Should handle all failure/error/skipped element variations', async () => {
		const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath)

		// Test specific scenarios from our comprehensive test
		const failureTests = testcases.filter((tc) => tc.status === 'failed')
		const errorTests = testcases.filter((tc) => tc.status === 'blocked')
		const skippedTests = testcases.filter((tc) => tc.status === 'skipped')

		// Verify we have the expected failure scenarios
		expect(failureTests.some((tc) => tc.name.includes('only type'))).toBe(true)
		expect(failureTests.some((tc) => tc.name.includes('type and message'))).toBe(true)
		expect(failureTests.some((tc) => tc.name.includes('type, message and text content'))).toBe(
			true
		)

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

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath)
		expect(testcases).toHaveLength(1)

		// Should parse as success (no failure/error/skipped present)
		expect(testcases[0].status).toBe('passed')

		// Message should include system-out content but not fail on empty system-err
		expect(testcases[0].message).toContain('ViewManager initialized')
	})

	test('Should handle Jest failure without type attribute', async () => {
		const xmlPath = `${xmlBasePath}/jest-failure-type-missing.xml`
		const xmlContent = await readFile(xmlPath, 'utf8')

		const testcases = await parseJUnitXml(xmlContent, xmlBasePath)
		expect(testcases).toHaveLength(3)

		// Verify test result types
		const typeCounts = testcases.reduce((acc, tc) => {
			acc[tc.status] = (acc[tc.status] || 0) + 1
			return acc
		}, {} as Record<string, number>)

		expect(typeCounts.passed).toBe(2)
		expect(typeCounts.failed).toBe(1)

		// Find the failure test case
		const failedTest = testcases.find((tc) => tc.status === 'failed')
		expect(failedTest).toBeDefined()
		expect(failedTest?.name).toContain('subtracts two numbers correctly')
		expect(failedTest?.message).toContain('expect(received).toBe(expected)')
	})
})
