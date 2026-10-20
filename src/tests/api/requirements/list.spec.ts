import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Requirement } from '../../../api/requirements'
import type { PaginatedResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'requirements', 'list', ...args)

describe('mocked', () => {
	const mockRequirements = [{ id: 1, text: 'User can login' }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/requirement/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json({ total: 1, offset: 0, limit: 100, data: mockRequirements })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists requirements', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ total: 1, offset: 0, limit: 100, data: mockRequirements })
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

describe('live', { tags: ['live'] }, () => {
	test('lists requirements', async ({ project }) => {
		const result = await runCli<PaginatedResponse<Requirement>>(
			'api',
			'requirements',
			'list',
			'--project-code',
			project.code
		)
		expect(Array.isArray(result.data)).toBe(true)
	})

	test('lists requirements with include', async ({ project }) => {
		const result = await runCli<PaginatedResponse<Requirement>>(
			'api',
			'requirements',
			'list',
			'--project-code',
			project.code,
			'--include',
			'tcaseCount'
		)
		expect(Array.isArray(result.data)).toBe(true)
		for (const req of result.data) {
			expect(req).toHaveProperty('tcaseCount')
			expect(typeof req.tcaseCount).toBe('number')
		}
	})
})
