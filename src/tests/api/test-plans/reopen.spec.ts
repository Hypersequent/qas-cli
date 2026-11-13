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
	createTestPlan,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-plans', 'reopen', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'ok' }
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/plan/:planId/reopen`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('reopens a test plan', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--plan-id', '1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.planId).toBe('1')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--plan-id', '1'])

	test('rejects a non-positive plan-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--plan-id', '0'),
			/--plan-id.*must be a positive integer/
		)
	})
})

test('reopens a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	await runCli(
		'api',
		'test-plans',
		'close',
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id)
	)
	const result = await runCommand<{ message: string }>(
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id)
	)
	expect(result.message).toBeTruthy()
})
