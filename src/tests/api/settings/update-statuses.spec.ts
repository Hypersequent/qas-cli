import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'
import type { Status } from '../../../api/settings'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'settings', 'update-statuses', ...args)

const listStatuses = () => runCli<Status[]>('api', 'settings', 'list-statuses')

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
		const statuses = [{ id: 'custom1', name: 'Retest', color: 'orange', isActive: true }]
		await runCommand('--statuses', JSON.stringify(statuses))
		expect(lastRequest).toEqual({
			statuses,
		})
	})
})

describe('validation errors', () => {
	test('rejects hex color values', async () => {
		const statuses = [{ id: 'custom1', name: 'Retest', color: '#FF9800', isActive: true }]
		await expectValidationError(
			() => runCommand('--statuses', JSON.stringify(statuses)),
			/color.*must be one of/i
		)
	})
})

describe('live', { tags: ['live'] }, () => {
	test('statuses use named colors', async () => {
		const validColors = new Set([
			'blue',
			'gray',
			'red',
			'orange',
			'yellow',
			'green',
			'teal',
			'indigo',
			'purple',
			'pink',
		])
		const statuses = await listStatuses()
		expect(statuses.length).toBeGreaterThan(0)
		for (const status of statuses) {
			expect(validColors).toContain(status.color)
		}
	})
})
