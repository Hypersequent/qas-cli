import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { SharedStep } from '../../../api/shared-steps'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-steps', 'list', ...args)

describe('mocked', () => {
	const mockData = [{ id: 1, title: 'Login steps' }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/shared-step`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			return HttpResponse.json({ sharedSteps: mockData })
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists shared steps', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockData)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

describe('live', { tags: ['live'] }, () => {
	test('lists shared steps', async ({ project }) => {
		const result = await runCli<SharedStep[]>(
			'api',
			'shared-steps',
			'list',
			'--project-code',
			project.code
		)
		expect(Array.isArray(result)).toBe(true)
	})

	test('lists shared steps with include', async ({ project }) => {
		const result = await runCli<SharedStep[]>(
			'api',
			'shared-steps',
			'list',
			'--project-code',
			project.code,
			'--include',
			'tcaseCount'
		)
		expect(Array.isArray(result)).toBe(true)
		for (const step of result) {
			expect(step).toHaveProperty('tcaseCount')
			expect(typeof step.tcaseCount).toBe('number')
		}
	})
})
