import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'settings', 'update-statuses', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null

	useMockServer(
		http.post(`${baseURL}/api/public/v0/settings/preferences/status`, async ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastRequest = await request.json()
			return HttpResponse.json({ message: 'Statuses updated' })
		})
	)

	beforeEach(() => {
		lastRequest = null
	})

	test('updates custom statuses', async () => {
		const statuses = [{ id: 'custom1', name: 'Retest', color: '#FF9800', isActive: true }]
		await runCommand('--statuses', JSON.stringify(statuses))
		expect(lastRequest).toEqual({
			statuses,
		})
	})
})
