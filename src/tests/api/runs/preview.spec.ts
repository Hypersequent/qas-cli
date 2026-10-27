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
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'preview', ...args)

describe('mocked', () => {
	const mockResponse = { total: 1, offset: 0, limit: 100, data: [{ id: 'tc1', title: 'Login' }] }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/preview-tcases`,
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

	test('previews a selection', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-type',
			'live',
			'--query-plans',
			'[{"tagIds": [1]}]',
			'--run-id',
			'7',
			'--limit',
			'20'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			runType: 'live',
			queryPlans: [{ tagIds: [1] }],
			runId: 7,
			limit: 20,
		})
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { runType: 'static', queryPlans: [{ tcaseIds: ['12'] }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--offset', '10'],
				expectedRequest: { runType: 'static', queryPlans: [{ tcaseIds: ['12'] }], offset: 10 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ runType: 'static', queryPlans: [] },
				/Must contain at least one query plan/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-type',
		'live',
		'--query-plans',
		'[{"tagIds": [1]}]',
	])

	test('requires a run type and query plans', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-type', 'live'),
			/Either --body, --body-file, or --run-type and --query-plans is required/
		)
	})

	test('rejects a limit above 1000', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--run-type',
					'live',
					'--query-plans',
					'[{"tagIds": [1]}]',
					'--limit',
					'1001'
				),
			/--limit.*must be at most 1000/
		)
	})
})

test('previews a selection on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	await createTCase(project.code, folderId)
	const result = await runCommand<{ total: number }>(
		'--project-code',
		project.code,
		'--run-type',
		'live',
		'--query-plans',
		JSON.stringify([{ folderIds: [folderId] }])
	)
	expect(result.total).toBe(1)
})
