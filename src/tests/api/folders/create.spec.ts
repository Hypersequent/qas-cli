import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { Folder } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'folders', 'create', ...args)

describe('mocked', () => {
	const mockFolder = { id: 7, parentId: 4, pos: 0, title: 'Login', comment: '', projectId: 'p1' }

	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/folder`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockFolder, { status: 201 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a folder', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Login',
			'--parent-id',
			'4',
			'--pos',
			'0',
			'--comment',
			'<p>Sign-in tests</p>'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Login',
			parentId: 4,
			pos: 0,
			comment: '<p>Sign-in tests</p>',
		})
		expect(result).toEqual(mockFolder)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Login' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'Original', parentId: 4 },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden', parentId: 4 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /title must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--title', 'Login'])

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --title is required/
		)
	})

	test('rejects an empty title', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', ''),
			/--title.*title must not be empty/
		)
	})

	test('rejects a negative parent-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', 'Login', '--parent-id', '-1'),
			/--parent-id.*non-negative/
		)
	})
})

test('creates a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await runCommand<Folder>('--project-code', project.code, '--title', 'LiveCreate')
	expect(typeof folder.id).toBe('number')
	expect(folder.title).toBe('LiveCreate')
	expect(folder.parentId).toBe(0)
})
