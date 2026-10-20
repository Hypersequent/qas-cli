import { randomBytes } from 'node:crypto'
import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { SharedPrecondition } from '../../../api/shared-preconditions'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-preconditions', 'delete', ...args)

describe('mocked', () => {
	let lastParams: PathParams = {}

	useMockServer(
		http.delete(
			`${baseURL}/api/public/v0/project/:projectCode/shared-precondition/:id`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json({ message: 'Precondition deleted' })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('deletes a shared precondition', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--id', '1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('1')
		expect(result).toEqual({ message: 'Precondition deleted' })
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--id', '1'])

	test('rejects a non-positive id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--id', '0'),
			/--id.*must be a positive integer/
		)
	})
})

test('deletes a shared precondition on live server', { tags: ['live'] }, async ({ project }) => {
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
	const result = await runCommand<{ message: string }>(
		'--project-code',
		project.code,
		'--id',
		String(created.id)
	)
	expect(result).toHaveProperty('message')
})
