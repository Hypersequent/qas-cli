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
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-plans', 'update-run', ...args)

describe('mocked', () => {
	const mockResponse = { id: 7, title: 'Chrome', assignmentId: 3 }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/plan/:planId/run/:runId`,
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

	test('updates a run of a test plan', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--plan-id',
			'1',
			'--run-id',
			'7',
			'--assignment-id',
			'3',
			'--configuration-id',
			'',
			'--query-plans',
			'[{"tcaseIds": ["12", "13"]}]'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.planId).toBe('1')
		expect(lastParams.runId).toBe('7')
		expect(lastRequest).toEqual({
			assignmentId: 3,
			configurationId: '',
			queryPlans: [{ tcaseIds: ['12', '13'] }],
		})
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Chrome' }
			const requiredArgs = ['--project-code', 'PRJ', '--plan-id', '1', '--run-id', '7']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--assignment-id', '0'],
				expectedRequest: { title: 'Chrome', assignmentId: 0 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ queryPlans: [] }, /exactly one query plan/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--plan-id',
		'1',
		'--run-id',
		'7',
		'--title',
		'X',
	])

	test('rejects a non-positive run-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--plan-id', '1', '--title', 'X', '--run-id', '0'),
			/--run-id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--plan-id', '1', '--run-id', '7'),
			/At least one field to update is required/
		)
	})
})

test('updates a run of a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	const got = await runCli<{ runs: { id: number }[] }>(
		'api',
		'test-plans',
		'get',
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id)
	)
	const result = await runCommand<{ title: string }>(
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id),
		'--run-id',
		String(got.runs[0].id),
		'--title',
		'CLI updated plan run'
	)
	expect(result.title).toBe('CLI updated plan run')
})
