import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Requirement } from '../../../api/requirements'
import type { MessageResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'requirements', 'delete', ...args)

describe('mocked', () => {
	let lastParams: PathParams = {}

	useMockServer(
		http.delete(
			`${baseURL}/api/public/v0/project/:projectCode/requirement/:requirementId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json({ message: 'Requirement deleted' })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('deletes a requirement', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--requirement-id', 'req1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.requirementId).toBe('req1')
		expect(result).toEqual({ message: 'Requirement deleted' })
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--requirement-id', 'req1'])
	testRejectsInvalidIdentifier(runCommand, 'requirement-id', 'resource', ['--project-code', 'PRJ'])

	test('requires a requirement ID', async () => {
		await expectValidationError(() => runCommand('--project-code', 'PRJ'), /requirement-id/)
	})
})

test('deletes a requirement on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Requirement>(
		'api',
		'requirements',
		'create',
		'--project-code',
		project.code,
		'--text',
		`CLI requirement ${randomBytes(4).toString('hex')}`
	)
	const result = await runCommand<MessageResponse>(
		'--project-code',
		project.code,
		'--requirement-id',
		created.id
	)
	expect(result).toHaveProperty('message')
})
