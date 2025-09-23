import { expect, test, describe } from 'vitest'
import { parseJUnitXml } from '../utils/junit/junitXmlParser'
import { readFile } from 'fs/promises'

const xmlBasePath = './src/tests/fixtures/junit-xml'

describe('Junit XML parsing', () => {
    test('Should parse comprehensive test XML without exceptions', async () => {
        const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
        const xmlContent = await readFile(xmlPath, 'utf8')

        // This should not throw any exceptions
        const result = await parseJUnitXml(xmlContent, xmlBasePath)

        // Verify that we got the expected number of test cases
        expect(result.testcases).toHaveLength(12)

        // Verify we have all the different test result types
        const testTypes = result.testcases.map(tc => tc.type)
        expect(testTypes).toContain('failure')
        expect(testTypes).toContain('error')
        expect(testTypes).toContain('skipped')
        expect(testTypes).toContain('success')

        // Verify specific counts by type
        const typeCounts = result.testcases.reduce((acc, tc) => {
            acc[tc.type] = (acc[tc.type] || 0) + 1
            return acc
        }, {} as Record<string, number>)

        expect(typeCounts.failure).toBe(3)
        expect(typeCounts.error).toBe(3)
        expect(typeCounts.skipped).toBe(4)
        expect(typeCounts.success).toBe(2)

        // Verify that test cases have expected properties
        result.testcases.forEach(tc => {
            expect(tc).toHaveProperty('name')
            expect(tc).toHaveProperty('type')
            expect(tc).toHaveProperty('attachments')
            expect(Array.isArray(tc.attachments)).toBe(true)
        })
    })

    test('Should handle all failure/error/skipped element variations', async () => {
        const xmlPath = `${xmlBasePath}/comprehensive-test.xml`
        const xmlContent = await readFile(xmlPath, 'utf8')

        const result = await parseJUnitXml(xmlContent, xmlBasePath)

        // Test specific scenarios from our comprehensive test
        const failureTests = result.testcases.filter(tc => tc.type === 'failure')
        const errorTests = result.testcases.filter(tc => tc.type === 'error')
        const skippedTests = result.testcases.filter(tc => tc.type === 'skipped')

        // Verify we have the expected failure scenarios
        expect(failureTests.some(tc => tc.name?.includes('only type'))).toBe(true)
        expect(failureTests.some(tc => tc.name?.includes('type and message'))).toBe(true)
        expect(failureTests.some(tc => tc.name?.includes('type, message and text content'))).toBe(true)

        // Verify we have the expected error scenarios
        expect(errorTests.some(tc => tc.name?.includes('only type'))).toBe(true)
        expect(errorTests.some(tc => tc.name?.includes('type and text content'))).toBe(true)
        expect(errorTests.some(tc => tc.name?.includes('type, message and text content'))).toBe(true)

        // Verify we have the expected skipped scenarios
        expect(skippedTests.some(tc => tc.name?.includes('Empty skipped'))).toBe(true)
        expect(skippedTests.some(tc => tc.name?.includes('only message'))).toBe(true)
        expect(skippedTests.some(tc => tc.name?.includes('only text content'))).toBe(true)
        expect(skippedTests.some(tc => tc.name?.includes('message and text content'))).toBe(true)
    })
})
