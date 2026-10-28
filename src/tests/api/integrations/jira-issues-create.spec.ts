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
	runCli<T>('api', 'integrations', 'jira', 'issues', 'create', ...args)

describe('mocked', () => {
	const mockResponse = {
		id: '10394',
		key: 'QA-12',
		url: 'https://acme.atlassian.net/browse/QA-12',
		attachmentUploadErrors: null,
		createdAs: 'integration',
	}
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/integration/jira/:integrationId/issue`,
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

	test('creates a Jira issue', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--summary',
			'Login fails',
			'--issue-type-id',
			'10001',
			'--description',
			'Steps',
			'--parent-id',
			'10300',
			'--other-fields',
			'{"priority": {"name": "High"}}'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			summary: 'Login fails',
			issueTypeId: '10001',
			description: 'Steps',
			parentId: '10300',
			otherFields: { priority: { name: 'High' } },
		})
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { summary: 'Login fails', issueTypeId: '10001' }
			const requiredArgs = ['--project-code', 'PRJ', '--integration-id', '1CSWAh3ys_YniqfXepnwT8F']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--summary', 'Logout fails'],
				expectedRequest: { summary: 'Logout fails', issueTypeId: '10001' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ summary: '', issueTypeId: '10001' },
				/summary must not be empty/,
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
		'--issue-type-id',
		'1',
	])

	test('requires a summary and an issue type', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--integration-id',
					'1CSWAh3ys_YniqfXepnwT8F',
					'--summary',
					'X'
				),
			/Either --body, --body-file, or --summary and --issue-type-id is required/
		)
	})
})
