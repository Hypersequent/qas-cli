import { expect, test, describe } from 'vitest'
import { parseXCResult } from '../utils/result-upload/xcresultSqliteParser'

const xcresultBasePath = './src/tests/fixtures/xcresult'

describe('XCResult parsing', () => {
	test('Should correctly parse all test cases from xcresult bundle', async () => {
		const testcases = await parseXCResult(
			`${xcresultBasePath}/Variety.xcresult`,
			xcresultBasePath,
			{
				skipStdout: 'never',
				skipStderr: 'never',
			}
		)

		// Verify total count
		expect(testcases).toHaveLength(5)

		// Verify each test case has required properties
		testcases.forEach((tc) => {
			expect(tc).toHaveProperty('name')
			expect(tc).toHaveProperty('folder')
			expect(tc).toHaveProperty('status')
			expect(tc).toHaveProperty('message')
			expect(tc).toHaveProperty('timeTaken')
			expect(tc).toHaveProperty('attachments')
			expect(Array.isArray(tc.attachments)).toBe(true)
		})

		// Test case 1: Passed test (TEST_002)
		const test1 = testcases.find((tc) => tc.name === 'test_TEST_002_AppLaunches')
		expect(test1).toBeDefined()
		expect(test1?.status).toBe('passed')
		expect(test1?.timeTaken ? Math.round(test1.timeTaken) : test1?.timeTaken).toBe(9045)
		expect(test1?.folder).toContain('BistroAppUITests')

		// Test case 2: Failed test with failure message (TEST_003)
		const test2 = testcases.find((tc) => tc.name === 'test_TEST_003_MenuShowsPizzas')
		expect(test2).toBeDefined()
		expect(test2?.status).toBe('failed')
		expect(test2?.timeTaken ? Math.round(test2.timeTaken) : test2?.timeTaken).toBe(9058)
		expect(test2?.folder).toContain('BistroAppUITests')
		expect(test2?.message).toContain('XCTAssertTrue failed')

		// Test case 3: Skipped test with skip reason (TEST_004)
		const test3 = testcases.find((tc) => tc.name === 'test_TEST_004_NavigateToCart')
		expect(test3).toBeDefined()
		expect(test3?.status).toBe('skipped')
		expect(test3?.timeTaken ? Math.round(test3.timeTaken) : test3?.timeTaken).toBe(7260)
		expect(test3?.folder).toContain('BistroAppUITests')
		expect(test3?.message).toContain('Skipped Reason')
		expect(test3?.message).toContain('Test not ready yet')

		// Test case 4: Another passed test (TEST_005)
		const test4 = testcases.find((tc) => tc.name === 'test_TEST_005_SwitchBetweenTabs')
		expect(test4).toBeDefined()
		expect(test4?.status).toBe('passed')
		expect(test4?.timeTaken ? Math.round(test4.timeTaken) : test4?.timeTaken).toBe(24564)
		expect(test4?.folder).toContain('BistroAppUITests')

		// Test case 5: Expected failure (blocked) with reason (TEST_006)
		const test5 = testcases.find((tc) => tc.name === 'test_TEST_006_AddItemAndCheckout')
		expect(test5).toBeDefined()
		expect(test5?.status).toBe('blocked')
		expect(test5?.timeTaken ? Math.round(test5.timeTaken) : test5?.timeTaken).toBe(24576)
		expect(test5?.folder).toContain('BistroAppUITests')
		expect(test5?.message).toContain('Expected Failure')
		expect(test5?.message).toContain('should fail')
	})
})
