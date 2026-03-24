import type { Run } from '../../../api/runs'
import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
	testRejectsInvalidPathParam,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'list', ...args)

describe('mocked', () => {
	const mockRuns = [{ id: 1, title: 'Run 1', type: 'static', closed: false }]

	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/run`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json({ runs: mockRuns })
		})
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists runs in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockRuns)
	})

	test('passes filter params', async ({ project }) => {
		await runCommand('--project-code', project.code, '--closed', '--limit', '10')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastSearchParams).not.toBeNull()
		expect(lastSearchParams!.get('closed')).toBe('true')
		expect(lastSearchParams!.get('limit')).toBe('10')
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code')
})

test('lists runs on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const result = await runCli<Run[]>('api', 'runs', 'list', '--project-code', project.code)
	expect(result.some((r) => r.id === run.id)).toBe(true)
})
