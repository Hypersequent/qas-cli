import { describe, expect, test } from 'vitest'

import { executeApiCommand } from '../commands/api/executor'
import { apiEndpointSpecById } from '../commands/api/manifest'

const enabled =
	process.env.QAS_API_E2E === '1' &&
	typeof process.env.QAS_URL === 'string' &&
	typeof process.env.QAS_TOKEN === 'string' &&
	(() => {
		try {
			new URL(process.env.QAS_URL!)
			return true
		} catch {
			return false
		}
	})()

describe.runIf(enabled)('public API real-instance smoke tests', () => {
	test('lists projects from the configured instance', async () => {
		const spec = apiEndpointSpecById.get('projects.list')!
		const response = await executeApiCommand(spec, {})

		expect(spec.responseSchema?.safeParse(response).success).toBe(true)
	})
})
