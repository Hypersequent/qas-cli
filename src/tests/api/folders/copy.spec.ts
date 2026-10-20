import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { FolderIdsResponse } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'copy', ...args)

describe('mocked', () => {
	const mockResponse = { folders: [{ id: 20 }, { id: 21 }] }

	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/folder/copy`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockResponse)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('copies folders', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--folder-ids',
			'4, 5',
			'--target-folder-id',
			'10',
			'--source-project-id',
			'OLD'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ folderIds: [4, 5], targetFolderId: 10, sourceProjectId: 'OLD' })
		expect(result).toEqual(mockResponse)
	})

	test('copies a folder to the root of the same project', async ({ project }) => {
		await runCommand('--project-code', project.code, '--folder-ids', '4')
		expect(lastRequest).toEqual({ folderIds: [4] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { folderIds: [4], targetFolderId: 10 }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--folder-ids', '6,7'],
				expectedRequest: { folderIds: [6, 7], targetFolderId: 10 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ folderIds: [] }, /Must contain at least one folder/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--folder-ids', '4'])

	test('requires folder-ids or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--target-folder-id', '10'),
			/Either --body, --body-file, or --folder-ids is required/
		)
	})

	test('rejects folder-ids that are not integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-ids', '4,abc'),
			/--folder-ids.*comma-separated positive integers/
		)
	})
})

test('copies a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const result = await runCommand<FolderIdsResponse>(
		'--project-code',
		project.code,
		'--folder-ids',
		String(folderId)
	)
	expect(result.folders).toHaveLength(1)
	expect(result.folders[0].id).not.toBe(folderId)
})
