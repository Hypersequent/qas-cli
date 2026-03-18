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

	test('creates a test plan', async ({ project }) => {
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
