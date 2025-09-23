import { expect, test, describe } from 'vitest'
import { processTemplate, monthNames } from '../utils/misc'

describe('Template string processing', () => {
	test('Should leave unknown environment variables unchanged', () => {
		const result = processTemplate('Build {env:UNKNOWN_VAR} completed')
		expect(result).toBe('Build {env:UNKNOWN_VAR} completed')
	})

	test('Should handle templates with no placeholders', () => {
		const template = 'Simple test run name'
		const result = processTemplate(template)
		expect(result).toBe('Simple test run name')
	})

	test('Should process all placeholder types correctly', () => {
		const oldEnv = process.env.TEST_BUILD
		process.env.TEST_BUILD = '456'

		try {
			const now = new Date()
			const template = '{env:TEST_BUILD} - {YYYY}/{YY}/{MMM}/{MM}/{DD} {HH}:{hh}:{mm}:{ss} {AMPM}'
			const result = processTemplate(template, now)

			const yearStr = String(now.getFullYear())
			const month = now.getMonth()
			const monthStr = String(month + 1).padStart(2, '0')
			const dayStr = String(now.getDate()).padStart(2, '0')
			const hour24 = now.getHours()
			const hour24Str = String(hour24).padStart(2, '0')
			const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
			const hour12Str = String(hour12).padStart(2, '0')
			const minStr = String(now.getMinutes()).padStart(2, '0')
			const secStr = String(now.getSeconds()).padStart(2, '0')
			const ampm = hour24 < 12 ? 'AM' : 'PM'

			const expectedResult = `456 - ${yearStr}/${yearStr.slice(-2)}/${
				monthNames[month]
			}/${monthStr}/${dayStr} ${hour24Str}:${hour12Str}:${minStr}:${secStr} ${ampm}`

			expect(result).toBe(expectedResult)
		} finally {
			// Restore original environment
			if (oldEnv !== undefined) {
				process.env.TEST_BUILD = oldEnv
			} else {
				delete process.env.TEST_BUILD
			}
		}
	})
})
