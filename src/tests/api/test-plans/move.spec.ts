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
	createMilestone,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-plans', 'move', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'Plans moved' }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/plan/milestone`,
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

	test('moves test plans into a milestone', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--plan-ids',
			'1,2',
			'--milestone-id',
			'5'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ planIds: [1, 2], milestoneId: 5 })
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { planIds: [1], milestoneId: 5 }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--plan-ids', '2'],
				expectedRequest: { planIds: [2], milestoneId: 5 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ planIds: [], milestoneId: 5 },
				/Must contain at least one plan ID/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--plan-ids',
		'1',
		'--milestone-id',
		'5',
	])

	test('rejects plan IDs that are not positive integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--plan-ids', '0', '--milestone-id', '5'),
			/--plan-ids.*must be comma-separated positive integers/
		)
	})

	test('requires plan IDs and a milestone', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--milestone-id', '5'),
			/Either --body, --body-file, or --plan-ids and --milestone-id is required/
		)
	})
})

test('moves a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const plan = await createTestPlan(project.code, [tcase.id])
	const milestone = await createMilestone(project.code)
	await runCommand(
		'--project-code',
		project.code,
		'--plan-ids',
		String(plan.id),
		'--milestone-id',
		String(milestone.id)
	)
	const moved = await runCli<{ milestoneId: number | null }>(
		'api',
		'test-plans',
		'get',
		'--project-code',
		project.code,
		'--plan-id',
		String(plan.id)
	)
	expect(moved.milestoneId).toBe(milestone.id)
})
