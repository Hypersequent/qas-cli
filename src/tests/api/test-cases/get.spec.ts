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

	// Always-present fields
	expect(result.id).toBe(created.id)
	expect(result).toHaveProperty('legacyId')
	expect(result).toHaveProperty('version')
	expect(result).toHaveProperty('type')
	expect(result).toHaveProperty('title')
	expect(result).toHaveProperty('seq')
	expect(result).toHaveProperty('folderId', folderId)
	expect(result).toHaveProperty('pos')
	expect(result).toHaveProperty('priority', 'medium')
	expect(result).toHaveProperty('comment')
	expect(result).toHaveProperty('authorId')
	expect(result).toHaveProperty('isDraft')
	expect(result).toHaveProperty('isLatestVersion')
	expect(result).toHaveProperty('isEmpty')
	expect(result).toHaveProperty('createdAt')
	expect(result).toHaveProperty('updatedAt')

	// Precondition object
	expect(result).toHaveProperty('precondition')
	expect(result.precondition).toHaveProperty('id')
	expect(result.precondition).toHaveProperty('type')
	expect(result.precondition).toHaveProperty('text')
	expect(result.precondition).toHaveProperty('version')
	expect(result.precondition).toHaveProperty('isLatest')
	expect(result.precondition).toHaveProperty('createdAt')
	expect(result.precondition).toHaveProperty('updatedAt')

	// Array fields present in get response (may be null for empty arrays)
	expect('files' in result).toBe(true)
	expect('links' in result).toBe(true)
	expect('steps' in result).toBe(true)
	expect('tags' in result).toBe(true)
	expect('requirements' in result).toBe(true)

	// Custom fields object
	expect(result).toHaveProperty('customFields')
})
