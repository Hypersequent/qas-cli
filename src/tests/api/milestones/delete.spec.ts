import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createMilestone,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'milestones', 'delete', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'ok' }
	let lastParams: PathParams = {}

	useMockServer(
		http.delete(
			`${baseURL}/api/public/v0/project/:projectCode/milestone/:milestoneId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('deletes a milestone', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--milestone-id', '1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.milestoneId).toBe('1')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--milestone-id', '1'])

	test('rejects a non-positive milestone-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--milestone-id', '0'),
			/--milestone-id.*must be a positive integer/
		)
	})
})

test('deletes a milestone on live server', { tags: ['live'] }, async ({ project }) => {
	const milestone = await createMilestone(project.code)
	const result = await runCommand<{ archivedAt?: string | null; message?: string }>(
		'--project-code',
		project.code,
		'--milestone-id',
		String(milestone.id)
	)
	expect(result.message).toBeTruthy()
})
