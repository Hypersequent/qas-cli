import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TrashEntry } from '../../../api/trash'
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

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'folders', 'delete', ...args)

describe('mocked', () => {
	const mockEntry = {
		id: '1CJo8oDjj_vkGo2rQAdzz4F',
		name: 'Folder Login (2 test cases)',
		resourceType: 'test_case',
		authorId: 1,
		author: { id: 1, name: 'Jane' },
		items: [
			{
				seq: 1,
				folderIds: [4, 5],
				tcaseIds: ['12', 'abc'],
				runIds: null,
				planIds: null,
				milestoneIds: null,
			},
		],
		createdAt: '2026-01-01T00:00:00Z',
	}

	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/folder/delete`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockEntry)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('deletes folders and test cases', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--folder-ids',
			'4,5',
			'--tcase-ids',
			'12,abc'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ folderIds: [4, 5], tcaseIds: ['12', 'abc'] })
		expect(result).toEqual(mockEntry)
	})

	test('deletes a single folder', async ({ project }) => {
		await runCommand('--project-code', project.code, '--folder-ids', '4')
		expect(lastRequest).toEqual({ folderIds: [4] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { folderIds: [4], tcaseIds: ['12'] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--folder-ids', '6'],
				expectedRequest: { folderIds: [6], tcaseIds: ['12'] },
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
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12'),
			/Either --body, --body-file, or --folder-ids is required/
		)
	})

	test('rejects folder-ids that are not integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-ids', '4;5'),
			/--folder-ids.*comma-separated positive integers/
		)
	})

	test('rejects malformed tcase-ids', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-ids', '4', '--tcase-ids', 'a/b'),
			/--tcase-ids.*comma-separated IDs/
		)
	})
})

test('deletes a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const entry = await runCommand<TrashEntry>(
		'--project-code',
		project.code,
		'--folder-ids',
		String(folderId)
	)
	expect(entry.resourceType).toBe('test_case')
	expect(entry.items.flatMap((item) => item.folderIds ?? [])).toContain(folderId)
})
