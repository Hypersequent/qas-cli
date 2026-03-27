import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { TCase } from '../../../api/tcases'
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
	runCli<T>('api', 'test-cases', 'get', ...args)

describe('mocked', () => {
	const mockTCase = { id: 'tc1', title: 'Login test', seq: 1 }

	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/tcase/:id`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			return HttpResponse.json(mockTCase)
		})
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a test case by ID', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--tcase-id', 'tc1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('tc1')
		expect(result).toEqual(mockTCase)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--tcase-id', 'tc1'])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', ['--project-code', 'PRJ'])
})

test('gets a test case on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const created = await createTCase(project.code, folderId)
	const result = await runCli<TCase>(
		'api',
		'test-cases',
		'get',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id
	)
	expect(result).toHaveProperty('id', created.id)
	expect(result).toHaveProperty('title')
})
