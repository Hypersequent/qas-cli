import { HttpResponse, http } from 'msw'
import { describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'settings', 'list-statuses', ...args)

describe('mocked', () => {
	const mockStatuses = [
		{ id: 'passed', name: 'Passed', color: '#4CAF50', isActive: true },
		{ id: 'custom1', name: 'Retest', color: '#FF9800', isActive: true },
	]

	useMockServer(
		http.get(`${baseURL}/api/public/v0/settings/preferences/status`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			return HttpResponse.json({ statuses: mockStatuses })
		})
	)

	test('lists result statuses', async () => {
		const result = await runCommand()
		expect(result).toEqual(mockStatuses)
	})
})
