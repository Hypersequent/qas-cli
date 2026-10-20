import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { Project } from '../../../api/projects'
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
	runCli<T>('api', 'projects', 'update', ...args)

describe('mocked', () => {
	const updated = { id: 'p1', code: 'PRJ', title: 'Checkout', teamMembers: [] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(`${baseURL}/api/public/v0/project/:projectCode`, async ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			lastRequest = await request.json()
			return HttpResponse.json(updated)
		})
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('updates the title and overview', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Checkout',
			'--overview-title',
			'Overview',
			'--overview-description',
			'<p>About</p>'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Checkout',
			overviewTitle: 'Overview',
			overviewDescription: '<p>About</p>',
		})
		expect(result).toEqual(updated)
	})

	test('archives and unarchives', async ({ project }) => {
		await runCommand('--project-code', project.code, '--archived')
		expect(lastRequest).toEqual({ archived: true })
		await runCommand('--project-code', project.code, '--archived', 'false')
		expect(lastRequest).toEqual({ archived: false })
	})

	test('replaces the team, ordering members by the list', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--team-members',
			JSON.stringify([
				{ userId: 1, role: 'QA lead' },
				{ userId: 2, role: 'Tester', pos: 5 },
			])
		)
		expect(lastRequest).toEqual({
			teamMembers: [
				{ userId: 1, role: 'QA lead', pos: 0 },
				{ userId: 2, role: 'Tester', pos: 5 },
			],
		})
	})

	test('an empty links list clears them', async ({ project }) => {
		await runCommand('--project-code', project.code, '--links', '[]')
		expect(lastRequest).toEqual({ links: [] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Checkout' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'From body', overviewTitle: 'Overview' },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden', overviewTitle: 'Overview' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /title must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--title', 'X'])

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/At least one field to update is required/
		)
	})

	test('rejects a team member without a role', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--team-members', '[{"userId": 1, "role": ""}]'),
			/--team-members.*role must not be empty/
		)
	})

	test('rejects a team member with an invalid user ID', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--team-members', '[{"userId": 0, "role": "QA"}]'),
			/--team-members.*userId must be a positive integer/
		)
	})
})

// Only the overview title changes, so cleanup can still find and delete the project
test('updates a project on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<Project>(
		'--project-code',
		project.code,
		'--overview-title',
		'CLI overview'
	)
	expect(result.code).toBe(project.code)
	expect(result.overviewTitle).toBe('CLI overview')
	expect(Array.isArray(result.teamMembers)).toBe(true)
})
