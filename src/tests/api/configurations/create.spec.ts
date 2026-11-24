import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { Configuration } from '../../../api/configurations'
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
	runCli<T>('api', 'configurations', 'create', ...args)

describe('mocked', () => {
	const created = { id: 'c1', title: 'Chrome', runCount: 0 }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/configuration`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(created, { status: 201 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a configuration', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--title', 'Chrome')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ title: 'Chrome' })
		expect(result).toEqual(created)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Chrome' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--title', 'Firefox'],
				expectedRequest: { title: 'Firefox' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: 'x'.repeat(65) }, /at most 64 characters/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--title', 'Chrome'])

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --title is required/
		)
	})

	test('rejects an empty title', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', ''),
			/--title.*must not be empty/
		)
	})
})

test('creates a configuration on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<Configuration>(
		'--project-code',
		project.code,
		'--title',
		'CLI configuration'
	)
	expect(result.title).toBe('CLI configuration')
	expect(result.runCount).toBe(0)
})
