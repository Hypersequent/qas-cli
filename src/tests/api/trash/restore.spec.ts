import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { MessageResponse } from '../../../api/schemas'
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
			/--ids.*must be comma-separated IDs/
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
	// Folder deletion is another command's job, so the live test calls the API directly.
	const deleted = await fetch(`${baseURL}/api/public/v0/project/${project.code}/folder/delete`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
		body: JSON.stringify({ folderIds: [folderId] }),
	}).then((r) => r.json() as Promise<{ id: string }>)

	const result = await runCommand<MessageResponse>(
		'--project-code',
		project.code,
		'--ids',
		deleted.id
	)
	expect(result).toHaveProperty('message')
})
