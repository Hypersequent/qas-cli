import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Folder, FolderListResponse } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'path', ...args)

describe('mocked', () => {
	const mockResponse = {
		folders: [
			{ id: 1, parentId: 0, pos: 0, title: 'Suite', comment: '', projectId: 'p1' },
			{ id: 4, parentId: 1, pos: 0, title: 'Login', comment: '', projectId: 'p1' },
		],
	}

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/folder/:folderId/path`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets the path of a folder', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--folder-id', '4')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.folderId).toBe('4')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--folder-id', '1'])

	test('rejects a non-positive folder-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-id', '-2'),
			/--folder-id.*must be a positive integer/
		)
	})
})

test('gets the path of a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<{ ids: number[][] }>(
		'api',
		'folders',
		'bulk-create',
		'--project-code',
		project.code,
		'--folders',
		JSON.stringify([{ path: ['PathParent', 'PathChild'] }])
	)
	const [parentId, childId] = created.ids[0]
	const result = await runCommand<FolderListResponse<Folder>>(
		'--project-code',
		project.code,
		'--folder-id',
		String(childId)
	)
	expect(result.folders.map((f) => f.id)).toEqual([parentId, childId])
})
