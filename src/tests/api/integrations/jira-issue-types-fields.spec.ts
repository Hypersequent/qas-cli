import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'integrations', 'jira', 'issue-types', 'fields', ...args)

describe('mocked', () => {
	const mockResponse = {
		fields: [{ fieldId: 'priority', key: 'priority', name: 'Priority', required: true }],
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/integration/jira/:integrationId/issue-type/:issueTypeId/field-metadata`,
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

	test('lists the fields of a Jira issue type', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--integration-id',
			'1CSWAh3ys_YniqfXepnwT8F',
			'--issue-type-id',
			'10001'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.issueTypeId).toBe('10001')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--integration-id',
		'1CSWAh3ys_YniqfXepnwT8F',
		'--issue-type-id',
		'10001',
	])

	// Jira's issue type IDs are numeric.
	test('rejects a non-numeric issue-type-id', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--integration-id',
					'1CSWAh3ys_YniqfXepnwT8F',
					'--issue-type-id',
					'bug'
				),
			/--issue-type-id/
		)
	})
})
