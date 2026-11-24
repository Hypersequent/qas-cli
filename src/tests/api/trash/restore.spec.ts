import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { MessageResponse } from '../../../api/schemas'
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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'trash', 'restore', ...args)

const entryA = '1CJo8oDjj_vkGo2rQAdzz4F'
const entryB = '1CJo8oDjj_vkGo2rQAdzz4G'

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/trash/restore`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ message: 'Restored' })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('restores trash entries', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--ids', `${entryA},${entryB}`)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ deleteLogIds: [entryA, entryB] })
		expect(result).toEqual({ message: 'Restored' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { deleteLogIds: [entryA] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { deleteLogIds: [entryA] },
				flags: ['--ids', entryB],
				expectedRequest: { deleteLogIds: [entryB] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ deleteLogIds: [] },
				/Must contain at least one trash entry ID/,
				requiredArgs
			)
			h.testInvalidBody(
				{ deleteLogIds: ['1CJo8oDjj'] },
				/trash entry IDs are 23 characters long/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--ids', entryA])

	test('rejects IDs with special characters', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--ids', `${entryA},a/b`),
			/--ids: must be comma-separated trash entry IDs/
		)
	})

	test('reports an ID of the wrong length against --ids', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--ids', 'abc'),
			/--ids: must be comma-separated trash entry IDs, each 23/
		)
	})

	// The API names the field deleteLogIds; the user typed --ids
	test('reports too many IDs against --ids', async () => {
		const ids = Array.from({ length: 101 }, () => entryA).join(',')
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--ids', ids),
			/--ids: Must contain at most 100 trash entry IDs/
		)
	})

	test('reports a bad ID in --body against --body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--body', '{"deleteLogIds": ["abc"]}'),
			/--body: deleteLogIds\.0: trash entry IDs are 23 characters long/
		)
	})

	test('requires IDs or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --ids is required/
		)
	})
})

test('restores a deleted folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const deleted = await runCli<TrashEntry>(
		'api',
		'folders',
		'delete',
		'--project-code',
		project.code,
		'--folder-ids',
		String(folderId)
	)

	const result = await runCommand<MessageResponse>(
		'--project-code',
		project.code,
		'--ids',
		deleted.id
	)
	expect(result).toHaveProperty('message')
})
