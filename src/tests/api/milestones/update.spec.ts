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
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'milestones', 'update', ...args)

describe('mocked', () => {
	const mockResponse = {
		id: 1,
		title: 'v1.1',
		createdAt: '2026-10-21T00:00:00Z',
		updatedAt: '2026-10-21T00:00:00Z',
		archivedAt: null,
		archivedBy: null,
	}
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/milestone/:milestoneId`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastRequest = null
	})

	test('renames a milestone', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--milestone-id',
			'1',
			'--title',
			'v1.1'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.milestoneId).toBe('1')
		expect(lastRequest).toEqual({ title: 'v1.1' })
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'v1.1' }
			const requiredArgs = ['--project-code', 'PRJ', '--milestone-id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--title', 'v1.2'],
				expectedRequest: { title: 'v1.2' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--milestone-id',
		'1',
		'--title',
		'X',
	])

	test('rejects a non-positive milestone-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', 'X', '--milestone-id', '0'),
			/--milestone-id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--milestone-id', '1'),
			/At least one field to update is required/
		)
	})
})

test('renames a milestone on live server', { tags: ['live'] }, async ({ project }) => {
	const milestone = await createMilestone(project.code)
	const result = await runCommand<{ title: string }>(
		'--project-code',
		project.code,
		'--milestone-id',
		String(milestone.id),
		'--title',
		`CLI renamed ${milestone.id}`
	)
	expect(result.title).toBe(`CLI renamed ${milestone.id}`)
})
