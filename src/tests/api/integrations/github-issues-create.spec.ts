import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
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
	runCli<T>('api', 'integrations', 'github', 'issues', 'create', ...args)

describe('mocked', () => {
	const mockResponse = { id: 13, url: 'https://github.com/acme/app/issues/13' }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/integration/github/:integrationId/issue`,
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

	test('creates a GitHub issue', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--summary',
			'Login fails',
			'--description',
			'Steps'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ summary: 'Login fails', description: 'Steps' })
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { summary: 'Login fails' }
			const requiredArgs = ['--project-code', 'PRJ', '--integration-id', '1CSWAh3ys_YniqfXepnwT8F']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--description', 'Steps'],
				expectedRequest: { summary: 'Login fails', description: 'Steps' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{
					summary:
						'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
				},
				/summary must be at most 255 characters/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
		'--summary',
		'X',
	])

	test('requires a summary', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--integration-id', '1CSWAh3ys_YniqfXepnwT8F'),
			/Either --body, --body-file, or --summary is required/
		)
	})
})
