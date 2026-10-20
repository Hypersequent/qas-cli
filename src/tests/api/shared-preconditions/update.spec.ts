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
	runCli<T>('api', 'shared-preconditions', 'update', ...args)

describe('mocked', () => {
	const updated = { id: 1, title: 'Logged in', text: '<p>Logged out</p>', tcaseCount: 3 }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/shared-precondition/:id`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(updated)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('updates the text', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--id',
			'1',
			'--text',
			'<p>Logged out</p>'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('1')
		expect(lastRequest).toEqual({ text: '<p>Logged out</p>' })
		expect(result).toEqual(updated)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Logged in' }
			const requiredArgs = ['--project-code', 'PRJ', '--id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'From body', text: 'x' },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden', text: 'x' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /title must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--id', '1', '--text', 'x'])

	test('rejects a non-positive id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--id', '0', '--text', 'x'),
			/--id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--id', '1'),
			/At least one field to update is required/
		)
	})
})

test('updates a shared precondition on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<SharedPrecondition>(
		'api',
		'shared-preconditions',
		'create',
		'--project-code',
		project.code,
		'--title',
		`CLI precondition ${randomBytes(4).toString('hex')}`,
		'--text',
		'<p>Logged in</p>'
	)
	const result = await runCommand<SharedPrecondition>(
		'--project-code',
		project.code,
		'--id',
		String(created.id),
		'--text',
		'<p>Logged out</p>'
	)
	expect(result.id).toBe(created.id)
	expect(result.text).toBe('<p>Logged out</p>')
})
