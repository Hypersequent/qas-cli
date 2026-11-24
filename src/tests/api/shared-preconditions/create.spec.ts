import { randomBytes } from 'node:crypto'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { SharedPrecondition } from '../../../api/shared-preconditions'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
	testBodyInput,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-preconditions', 'create', ...args)

describe('mocked', () => {
	const created = { id: 1, title: 'Logged in', text: '<p>Logged in</p>', tcaseCount: 0 }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/shared-precondition`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(created, { status: 201 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a shared precondition', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Logged in',
			'--text',
			'<p>Logged in</p>'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ title: 'Logged in', text: '<p>Logged in</p>' })
		expect(result).toEqual(created)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Logged in', text: '<p>Logged in</p>' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--text', '<p>Logged out</p>'],
				expectedRequest: { ...validBody, text: '<p>Logged out</p>' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: 'Logged in', text: '' }, /text must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--title',
		'Logged in',
		'--text',
		'x',
	])

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--text', 'x'),
			/Either --body, --body-file, or --title is required/
		)
	})

	test('rejects a title over 255 characters', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', 'x'.repeat(256), '--text', 'x'),
			/--title.*must be at most 255 characters/
		)
	})
})

test('creates a shared precondition on live server', { tags: ['live'] }, async ({ project }) => {
	const title = `CLI precondition ${randomBytes(4).toString('hex')}`
	const result = await runCommand<SharedPrecondition>(
		'--project-code',
		project.code,
		'--title',
		title,
		'--text',
		'<p>The user is logged in</p>'
	)
	expect(result.title).toBe(title)
	expect(result.tcaseCount).toBe(0)
})
