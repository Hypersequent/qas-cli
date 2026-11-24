import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { Folder } from '../../../api/folders'
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
	runCli<T>('api', 'folders', 'update', ...args)

describe('mocked', () => {
	const mockFolder = { id: 4, parentId: 0, pos: 0, title: 'Sign in', comment: '', projectId: 'p1' }

	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/folder/:folderId`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockFolder)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('renames a folder', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--folder-id',
			'4',
			'--title',
			'Sign in'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.folderId).toBe('4')
		expect(lastRequest).toEqual({ title: 'Sign in' })
		expect(result).toEqual(mockFolder)
	})

	test('clears the comment with an empty --comment', async ({ project }) => {
		await runCommand('--project-code', project.code, '--folder-id', '4', '--comment', '')
		expect(lastRequest).toEqual({ comment: '' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Sign in', comment: '<p>Auth</p>' }
			const requiredArgs = ['--project-code', 'PRJ', '--folder-id', '4']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'Original' },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({}, /title or comment is required/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--folder-id',
		'4',
		'--title',
		'Sign in',
	])

	test('rejects a non-positive folder-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-id', '0', '--title', 'Sign in'),
			/--folder-id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--folder-id', '4'),
			/At least one field to update is required/
		)
	})
})

test('renames a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folderId = (await createFolder(project.code)).ids[0][0]
	const folder = await runCommand<Folder>(
		'--project-code',
		project.code,
		'--folder-id',
		String(folderId),
		'--title',
		'LiveRenamed'
	)
	expect(folder.id).toBe(folderId)
	expect(folder.title).toBe('LiveRenamed')
})
