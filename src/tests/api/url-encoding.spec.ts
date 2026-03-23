import { HttpResponse, http } from 'msw'
import { describe, expect, afterEach } from 'vitest'
import { test, baseURL, useMockServer, runCli } from './test-helper'

describe('URL encoding of path parameters', () => {
	let lastUrl: URL | null = null

	afterEach(() => {
		lastUrl = null
	})

	describe('projects', () => {
		useMockServer(
			http.get(`${baseURL}/api/public/v0/project/:projectCode`, ({ request }) => {
				lastUrl = new URL(request.url)
				return HttpResponse.json({ id: 'p1', code: 'PRJ', title: 'Test' })
			})
		)

		test('encodes special characters in project code', async () => {
			await runCli('api', 'projects', 'get', '--project-code', 'PRJ [1]')
			expect(lastUrl).not.toBeNull()
			expect(lastUrl!.pathname).toContain('PRJ%20%5B1%5D')
		})
	})

	describe('runs list', () => {
		useMockServer(
			http.get(`${baseURL}/api/public/v0/project/:projectCode/run`, ({ request }) => {
				lastUrl = new URL(request.url)
				return HttpResponse.json({ runs: [] })
			})
		)

		test('encodes special characters in project code for runs', async () => {
			await runCli('api', 'runs', 'list', '--project-code', 'PRJ [1]')
			expect(lastUrl).not.toBeNull()
			expect(lastUrl!.pathname).toContain('PRJ%20%5B1%5D')
		})
	})

	describe('test-cases get', () => {
		useMockServer(
			http.get(`${baseURL}/api/public/v0/project/:projectCode/tcase/:id`, ({ request }) => {
				lastUrl = new URL(request.url)
				return HttpResponse.json({
					id: 'tc1',
					seq: 1,
					title: 'Test',
					version: 1,
					projectId: 'p1',
					folderId: 1,
				})
			})
		)

		test('encodes special characters in project code and tcase id', async () => {
			await runCli('api', 'test-cases', 'get', '--project-code', 'PRJ [1]', '--tcase-id', 'tc [2]')
			expect(lastUrl).not.toBeNull()
			expect(lastUrl!.pathname).toContain('PRJ%20%5B1%5D')
			expect(lastUrl!.pathname).toContain('tc%20%5B2%5D')
		})
	})

	describe('milestones list', () => {
		useMockServer(
			http.get(`${baseURL}/api/public/v0/project/:projectCode/milestone`, ({ request }) => {
				lastUrl = new URL(request.url)
				return HttpResponse.json({ milestones: [] })
			})
		)

		test('encodes special characters in project code for milestones', async () => {
			await runCli('api', 'milestones', 'list', '--project-code', 'PRJ [1]')
			expect(lastUrl).not.toBeNull()
			expect(lastUrl!.pathname).toContain('PRJ%20%5B1%5D')
		})
	})
})
