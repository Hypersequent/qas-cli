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
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'count', ...args)

describe('mocked', () => {
	let lastUrl: URL | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/tcase/count`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			lastUrl = new URL(request.url)
			return HttpResponse.json({ count: 42 })
		})
	)

	afterEach(() => {
		lastUrl = null
		lastParams = {}
	})

	test('counts test cases', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ count: 42 })
	})

	test('passes recursive param as query parameter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--folders', '1,2', '--recursive')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastUrl).not.toBeNull()
		expect(lastUrl!.searchParams.get('recursive')).toEqual('true')
		expect(lastUrl!.searchParams.getAll('folders')).toEqual(['1', '2'])
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

test('counts test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	await createTCase(project.code, folderId)
	const result = await runCli<{ count: number }>(
		'api',
		'test-cases',
		'count',
		'--project-code',
		project.code
	)
	expect(result).toHaveProperty('count')
	expect(result.count).toBeGreaterThanOrEqual(1)
})
