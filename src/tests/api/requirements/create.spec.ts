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
	runCli<T>('api', 'requirements', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/requirement`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(
					{ id: 'req1', ...(lastRequest as object), tcaseCount: 0 },
					{ status: 201 }
				)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a requirement', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--text',
			'Login',
			'--url',
			'https://example.com/spec/login'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ text: 'Login', url: 'https://example.com/spec/login' })
		expect(result).toEqual({
			id: 'req1',
			text: 'Login',
			url: 'https://example.com/spec/login',
			tcaseCount: 0,
		})
	})

	test('links the requirement to an issue', async () => {
		await runCommand('--project-code', 'PRJ', '--text', 'Login', '--integration-issue-id', 'PROJ-1')
		expect(lastRequest).toEqual({ text: 'Login', integrationIssueId: 'PROJ-1' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { text: 'Login', url: 'https://example.com/spec/login' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { text: 'Original' },
				flags: ['--text', 'Overridden'],
				expectedRequest: { text: 'Overridden' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ text: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--text', 'Login'])

	test('rejects a URL that is not http or https', async () => {
		for (const url of ['not a url', 'ftp://example.com/req']) {
			await expectValidationError(
				() => runCommand('--project-code', 'PRJ', '--text', 'Login', '--url', url),
				/--url.*must be an http or https URL/
			)
		}
	})

	test('requires text or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --text is required/
		)
	})
})

test('creates a requirement on live server', { tags: ['live'] }, async ({ project }) => {
	const text = `CLI requirement ${randomBytes(4).toString('hex')}`
	const created = await runCommand<Requirement>(
		'--project-code',
		project.code,
		'--text',
		text,
		'--url',
		'https://example.com/spec'
	)
	expect(created.text).toBe(text)
	expect(created.url).toBe('https://example.com/spec')
	expect(typeof created.id).toBe('string')
})
