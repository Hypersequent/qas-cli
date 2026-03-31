import type { RunTCase } from '../../../api/runs'
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
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'test-cases', 'list', ...args)

describe('mocked', () => {
	const mockTCases = [{ id: 'tc1', title: 'Test', seq: 1 }]
	const mockResponse = { tcases: mockTCases }

	let lastUrl: URL | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/tcase`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastUrl = new URL(request.url)
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastUrl = null
		lastParams = {}
	})

	test('lists test cases in a run', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual(mockTCases)
	})

	test('passes include param as query parameter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--run-id', '42', '--include', 'folder')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastUrl).not.toBeNull()
		expect(lastUrl!.searchParams.get('include')).toEqual('folder')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--run-id', '1'])
})

describe('live', { tags: ['live'] }, () => {
	test('lists test cases in a run', async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const tcase = await createTCase(project.code, folderId)
		const run = await createRun(project.code, [tcase.id])
		const result = await runCli<RunTCase[]>(
			'api',
			'runs',
			'test-cases',
			'list',
			'--project-code',
			project.code,
			'--run-id',
			String(run.id)
		)
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBe(1)
	})

	test('lists test cases in a run with include', async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const tcase = await createTCase(project.code, folderId)
		const run = await createRun(project.code, [tcase.id])
		const result = await runCli<RunTCase[]>(
			'api',
			'runs',
			'test-cases',
			'list',
			'--project-code',
			project.code,
			'--run-id',
			String(run.id),
			'--include',
			'folder'
		)
		expect(Array.isArray(result)).toBe(true)
		expect(result.length).toBe(1)
		const rtcase = result[0]
		expect(rtcase).toHaveProperty('folder')
		expect(rtcase.folder).toHaveProperty('id')
		expect(rtcase.folder).toHaveProperty('title')
	})
})
