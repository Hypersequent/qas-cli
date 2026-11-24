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
	runCli<T>('api', 'configurations', 'update', ...args)

describe('mocked', () => {
	const updated = { id: 'c1', title: 'Firefox', runCount: 2 }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/configuration/:id`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(updated)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('renames a configuration', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--configuration-id',
			'c1',
			'--title',
			'Firefox'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('c1')
		expect(lastRequest).toEqual({ title: 'Firefox' })
		expect(result).toEqual(updated)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Firefox' }
			const requiredArgs = ['--project-code', 'PRJ', '--configuration-id', 'c1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--title', 'Safari'],
				expectedRequest: { title: 'Safari' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--configuration-id',
		'c1',
		'--title',
		'X',
	])
	testRejectsInvalidIdentifier(runCommand, 'configuration-id', 'resource', [
		'--project-code',
		'PRJ',
		'--title',
		'X',
	])

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--configuration-id', 'c1'),
			/Either --body, --body-file, or --title is required/
		)
	})
})

test('renames a configuration on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Configuration>(
		'api',
		'configurations',
		'create',
		'--project-code',
		project.code,
		'--title',
		'CLI configuration'
	)
	const result = await runCommand<Configuration>(
		'--project-code',
		project.code,
		'--configuration-id',
		created.id,
		'--title',
		'CLI renamed configuration'
	)
	expect(result.id).toBe(created.id)
	expect(result.title).toBe('CLI renamed configuration')
})
