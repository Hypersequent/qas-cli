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
	runCli<T>('api', 'test-plans', 'update', ...args)

describe('mocked', () => {
	const mockResponse = { id: 1, title: 'Release 2', milestoneId: null, closedAt: null, runs: [] }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/plan/:planId`,
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

	test('updates a test plan', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--plan-id',
			'1',
			'--title',
			'Release 2',
			'--milestone-id',
			'0',
			'--integration-issue-id',
			''
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.planId).toBe('1')
		expect(lastRequest).toEqual({ title: 'Release 2', milestoneId: 0, integrationIssueId: '' })
		expect(result).toEqual(mockResponse)
	})

	test('replaces the runs, keeping one by id', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--plan-id',
			'1',
			'--runs',
			'[{"id": 7, "title": "Chrome", "queryPlans": [{"tcaseIds": ["12"]}]}]'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			runs: [{ id: 7, title: 'Chrome', queryPlans: [{ tcaseIds: ['12'] }] }],
		})
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Release 2' }
			const requiredArgs = ['--project-code', 'PRJ', '--plan-id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--description', 'Second release'],
				expectedRequest: { title: 'Release 2', description: 'Second release' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--plan-id',
		'1',
		'--title',
		'X',
	])

	test('rejects a non-positive plan-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', 'X', '--plan-id', '0'),
			/--plan-id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--plan-id', '1'),
			/At least one field to update is required/
		)
	})

	test('rejects a run with two query plans', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--plan-id',
					'1',
					'--runs',
					'[{"title": "Chrome", "queryPlans": [{"tcaseIds": ["1"]}, {"tcaseIds": ["2"]}]}]'
				),
			/--runs.*exactly one query plan/
		)
	})
})

test('updates a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	const result = await runCommand<{ title: string }>(
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id),
		'--title',
		'CLI updated plan'
	)
	expect(result.title).toBe('CLI updated plan')
})
