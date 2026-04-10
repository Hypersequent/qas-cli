import { HttpResponse, http } from 'msw'
import { describe, expect } from 'vitest'
import type { Project } from '../../../api/projects'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'projects', 'list', ...args)

describe('mocked', () => {
	const mockProjects = [
		{ id: 'p1', code: 'PRJ', title: 'Project 1' },
		{ id: 'p2', code: 'TST', title: 'Project 2' },
	]

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			return HttpResponse.json({ projects: mockProjects })
		})
	)

	test('lists all projects', async () => {
		const result = await runCommand()
		expect(result).toEqual(mockProjects)
	})
})

test('lists projects on live server', { tags: ['live'] }, async () => {
	const result = await runCommand()
	expect(Array.isArray(result)).toBe(true)
	for (const p of result as Project[]) {
		expect(p).toHaveProperty('id')
		expect(p).toHaveProperty('code')
		expect(p).toHaveProperty('title')
	}
})
