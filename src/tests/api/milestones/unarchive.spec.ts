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
	runCli<T>('api', 'milestones', 'unarchive', ...args)

describe('mocked', () => {
	const mockResponse = {
		id: 1,
		title: 'v1.0',
		createdAt: '2026-10-21T00:00:00Z',
		updatedAt: '2026-10-21T00:00:00Z',
		archivedAt: null,
		archivedBy: null,
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/milestone/:milestoneId/unarchive`,
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

	test('unarchives a milestone', async ({ project }) => {
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

test('unarchives a milestone on live server', { tags: ['live'] }, async ({ project }) => {
	const milestone = await createMilestone(project.code)
	await runCli(
		'api',
		'milestones',
		'archive',
		'--project-code',
		project.code,
		'--milestone-id',
		String(milestone.id)
	)
	const result = await runCommand<{ archivedAt?: string | null; message?: string }>(
		'--project-code',
		project.code,
		'--milestone-id',
		String(milestone.id)
	)
	expect(result.archivedAt).toBeNull()
})
