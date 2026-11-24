import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Folder } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'get', ...args)

describe('mocked', () => {
	const mockFolder = { id: 4, parentId: 0, pos: 0, title: 'Login', comment: '', projectId: 'p1' }

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/folder/:folderId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockFolder)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a folder', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--folder-id', '4')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.folderId).toBe('4')
		expect(result).toEqual(mockFolder)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--folder-id', '1'])

	test('rejects a non-positive folder-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-id', '0'),
			/--folder-id.*must be a positive integer/
		)
	})
})

test('gets a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const folder = await runCommand<Folder>(
		'--project-code',
		project.code,
		'--folder-id',
		String(folderId)
	)
	expect(folder.id).toBe(folderId)
})
