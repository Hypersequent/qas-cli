import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createFolder,
	createTCase,
	createRun,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'bulk-reopen', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'ok' }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/reopen`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastRequest = null
	})

	test('reopens runs', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-ids', '1, 2')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ runIds: [1, 2] })
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { runIds: [1] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--run-ids', '2'],
				expectedRequest: { runIds: [2] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ runIds: [] }, /Must contain at least one run ID/, requiredArgs)
			h.testInvalidBody(
				{
					runIds: [
						1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
						25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
						47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68,
						69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
						91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101,
					],
				},
				/Must contain at most 100 run IDs/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--run-ids', '1'])

	test('rejects run IDs that are not positive integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-ids', '1,0'),
			/--run-ids.*must be comma-separated positive integers/
		)
	})

	test('requires run IDs or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --run-ids is required/
		)
	})
})

test('reopens runs on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	await runCli('api', 'runs', 'close', '--project-code', project.code, '--run-id', String(run.id))
	await runCommand('--project-code', project.code, '--run-ids', String(run.id))
	const reopened = await runCli<{ closedAt: string | null }>(
		'api',
		'runs',
		'get',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(reopened.closedAt).toBeNull()
})
