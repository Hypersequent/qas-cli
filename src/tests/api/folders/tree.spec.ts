import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { FolderListResponse, FolderTreeNode } from '../../../api/folders'
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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'tree', ...args)

describe('mocked', () => {
	const mockResponse = {
		folders: [
			{
				id: 1,
				parentId: 0,
				pos: 0,
				title: 'Suite',
				comment: '',
				projectId: 'p1',
				tcaseCount: 3,
				children: [
					{
						id: 4,
						parentId: 1,
						pos: 0,
						title: 'Login',
						comment: '',
						projectId: 'p1',
						tcaseCount: 3,
					},
				],
			},
		],
	}

	let lastUrl: URL | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/folder/tree`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			lastUrl = new URL(request.url)
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastUrl = null
		lastParams = {}
	})

	test('gets the folder tree', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastUrl!.searchParams.has('include')).toBe(false)
		expect(result).toEqual(mockResponse)
	})

	test('passes include as a query parameter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--include', 'tcaseCount')
		expect(lastUrl!.searchParams.getAll('include')).toEqual(['tcaseCount'])
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects an unknown include value', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--include', 'path'),
			/include|choices|path/i
		)
	})
})

test('gets the folder tree on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const result = await runCommand<FolderListResponse<FolderTreeNode>>(
		'--project-code',
		project.code,
		'--include',
		'tcaseCount'
	)
	const folder = result.folders.find((f) => f.id === folderId)
	expect(folder).toBeDefined()
	expect(folder!.tcaseCount).toBe(0)
})
