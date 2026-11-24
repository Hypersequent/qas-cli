import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'daily-stats', ...args)

describe('mocked', () => {
	const mockResponse = { data: [{ date: '2026-10-01', count: 120, countDelta: 4 }] }
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/daily-stats`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('gets the daily test case counts', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams!.toString()).toBe('')
		expect(result).toEqual(mockResponse)
	})

	test('passes the day range', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--start-date',
			'2026-10-01',
			'--end-date',
			'2026-10-31'
		)
		expect(lastSearchParams!.get('startDate')).toBe('2026-10-01')
		expect(lastSearchParams!.get('endDate')).toBe('2026-10-31')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects a day that is not YYYY-MM-DD', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--start-date', '2026-10-01T00:00:00Z'),
			/--start-date.*must be a UTC day as YYYY-MM-DD/
		)
	})
})

test('gets the daily test case counts on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<{ data: unknown[] }>('--project-code', project.code)
	expect(Array.isArray(result.data)).toBe(true)
})
