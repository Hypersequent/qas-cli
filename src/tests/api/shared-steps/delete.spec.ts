import { randomBytes } from 'node:crypto'
import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { SharedStep } from '../../../api/shared-steps'
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
	runCli<T>('api', 'shared-steps', 'delete', ...args)

describe('mocked', () => {
	let lastParams: PathParams = {}

	useMockServer(
		http.delete(
			`${baseURL}/api/public/v0/project/:projectCode/shared-step/:id`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json({ message: 'Step deleted' })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('deletes a shared step', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--id', '1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('1')
		expect(result).toEqual({ message: 'Step deleted' })
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

test('deletes a shared step on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<SharedStep>(
		'api',
		'shared-steps',
		'create',
		'--project-code',
		project.code,
		'--title',
		`CLI step ${randomBytes(4).toString('hex')}`,
		'--sub-steps',
		JSON.stringify([{ description: 'Open' }])
	)
	const result = await runCommand<{ message: string }>(
		'--project-code',
		project.code,
		'--id',
		String(created.id)
	)
	expect(result).toHaveProperty('message')
})
