import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Milestone } from '../../../api/milestones'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'milestones', 'list', ...args)

describe('mocked', () => {
	const mockMilestones = [{ id: 1, title: 'v1.0', archived: false }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/milestone`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			return HttpResponse.json({ milestones: mockMilestones })
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists milestones in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockMilestones)
	})
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
	const list = await runCli<Milestone[]>(
		'api',
		'milestones',
		'list',
		'--project-code',
		project.code
	)
	expect(list.some((m) => m.id === created.id)).toBe(true)
})
