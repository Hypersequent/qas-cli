import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Milestone } from '../../../api/milestones'
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
	runCli<T>('api', 'milestones', 'list', ...args)

describe('mocked', () => {
	const mockMilestones = [{ id: 1, title: 'v1.0', archivedAt: null }]

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/milestone/paginated`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastSearchParams = new URL(request.url).searchParams
				return HttpResponse.json({ total: 1, offset: 0, limit: 100, data: mockMilestones })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists milestones in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ total: 1, offset: 0, limit: 100, data: mockMilestones })
	})

	test('passes the archived filter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--archived')
		expect(lastSearchParams?.get('archived')).toBe('true')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

test('creates and lists milestones on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<{ id: number }>(
		'api',
		'milestones',
		'create',
		'--project-code',
		project.code,
		'--title',
		'v1.0'
	)
	const list = await runCli<PaginatedResponse<Milestone>>(
		'api',
		'milestones',
		'list',
		'--project-code',
		project.code
	)
	expect(list.data.find((m) => m.id === created.id)?.archivedAt).toBeNull()
})
