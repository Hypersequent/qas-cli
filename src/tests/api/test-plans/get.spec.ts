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
	runCli<T>('api', 'test-plans', 'get', ...args)

describe('mocked', () => {
	const mockResponse = { id: 1, title: 'Release', milestoneId: null, closedAt: null, runs: [] }
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/plan/:planId`,
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

	test('gets a test plan', async ({ project }) => {
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

test('gets a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	const result = await runCommand<{ id: number; runs: unknown[] }>(
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id)
	)
	expect(result.id).toBe(plan.id)
	expect(result.runs).toHaveLength(1)
})
