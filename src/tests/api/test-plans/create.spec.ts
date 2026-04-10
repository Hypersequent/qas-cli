import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { CreateTestPlanResponse } from '../../../api/test-plans'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	testRejectsInvalidIdentifier,
	testBodyInput,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-plans', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(`${baseURL}/api/public/v0/project/:projectCode/plan`, async ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			lastRequest = await request.json()
			return HttpResponse.json({ id: 1 })
		})
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a test plan with --body', async ({ project }) => {
		const body = JSON.stringify({
			title: 'Plan',
			runs: [
				{
					title: 'Run 1',
					type: 'static',
					queryPlans: [{ tcaseIds: ['abc'] }],
				},
			],
		})
		const result = await runCommand('--project-code', project.code, '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Plan',
			runs: [
				{
					title: 'Run 1',
					type: 'static',
					queryPlans: [{ tcaseIds: ['abc'] }],
				},
			],
		})
		expect(result).toEqual({ id: 1 })
	})

	test('creates a test plan with individual fields', async ({ project }) => {
		const runs = JSON.stringify([
			{ title: 'Run 1', type: 'static', queryPlans: [{ tcaseIds: ['abc'] }] },
		])
		const result = await runCommand(
			'--project-code',
			project.code,
			'--title',
			'My Plan',
			'--runs',
			runs,
			'--description',
			'A test plan',
			'--milestone-id',
			'5'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'My Plan',
			description: 'A test plan',
			milestoneId: 5,
			runs: [{ title: 'Run 1', type: 'static', queryPlans: [{ tcaseIds: ['abc'] }] }],
		})
		expect(result).toEqual({ id: 1 })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = {
				title: 'Plan',
				runs: [{ title: 'Run 1', type: 'static', queryPlans: [{ tcaseIds: ['abc'] }] }],
			}
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--title', 'Overridden Title'],
				expectedRequest: { ...validBody, title: 'Overridden Title' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ title: '', runs: [] },
				/must not be empty|Must contain at least one run/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--body',
		JSON.stringify({
			title: 'Plan',
			runs: [{ title: 'Run', type: 'static', queryPlans: [{ tcaseIds: ['abc'] }] }],
		}),
	])
})

test('creates a test plan on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const result = await runCli<CreateTestPlanResponse>(
		'api',
		'test-plans',
		'create',
		'--project-code',
		project.code,
		'--body',
		JSON.stringify({
			title: 'Live Plan',
			runs: [
				{
					title: 'Run 1',
					type: 'static',
					queryPlans: [{ tcaseIds: [tcase.id] }],
				},
			],
		})
	)
	expect(result).toHaveProperty('id')
})
