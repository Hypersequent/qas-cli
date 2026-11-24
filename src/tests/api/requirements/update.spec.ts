import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Requirement } from '../../../api/requirements'
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
	runCli<T>('api', 'requirements', 'update', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/requirement/:requirementId`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ id: 'req1', text: 'Sign in', url: '', tcaseCount: 0 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('updates a requirement', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--requirement-id',
			'req1',
			'--text',
			'Sign in'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.requirementId).toBe('req1')
		expect(lastRequest).toEqual({ text: 'Sign in' })
		expect(result).toEqual({ id: 'req1', text: 'Sign in', url: '', tcaseCount: 0 })
	})

	test('sends empty strings to clear the URL and the issue link', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--requirement-id',
			'req1',
			'--url',
			'',
			'--integration-issue-id',
			''
		)
		expect(lastRequest).toEqual({ url: '', integrationIssueId: '' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { text: 'Sign in' }
			const requiredArgs = ['--project-code', 'PRJ', '--requirement-id', 'req1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { text: 'Original', url: 'https://example.com' },
				flags: ['--text', 'Overridden'],
				expectedRequest: { text: 'Overridden', url: 'https://example.com' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ text: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--requirement-id',
		'req1',
		'--text',
		'Sign in',
	])
	testRejectsInvalidIdentifier(runCommand, 'requirement-id', 'resource', [
		'--project-code',
		'PRJ',
		'--text',
		'Sign in',
	])

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--requirement-id', 'req1'),
			/At least one field to update is required/
		)
	})
})

test('updates a requirement on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Requirement>(
		'api',
		'requirements',
		'create',
		'--project-code',
		project.code,
		'--text',
		`CLI requirement ${randomBytes(4).toString('hex')}`,
		'--url',
		'https://example.com/spec'
	)
	const text = `CLI requirement ${randomBytes(4).toString('hex')}`
	const updated = await runCommand<Requirement>(
		'--project-code',
		project.code,
		'--requirement-id',
		created.id,
		'--text',
		text
	)
	expect(updated.text).toBe(text)
	expect(updated.url).toBe('https://example.com/spec')
})
