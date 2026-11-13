import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { MessageResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
	testBodyInput,
	createReport,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'reports', 'delete', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/report/delete`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ message: 'Reports deleted' })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('deletes reports by ID or sequence number', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--report-ids',
			'3, 1CTd8wPzM_hKz5Pq9EksXGH'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ reportIds: ['3', '1CTd8wPzM_hKz5Pq9EksXGH'] })
		expect(result).toEqual({ message: 'Reports deleted' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { reportIds: ['3'] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--report-ids', '4'],
				expectedRequest: { reportIds: ['4'] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ reportIds: [] }, /Must contain at least one report/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--report-ids', '3'])

	test('requires report IDs or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --report-ids is required/
		)
	})

	test('rejects report IDs with other characters', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--report-ids', '3,a/b'),
			/--report-ids.*must be comma-separated IDs/
		)
	})
})

test('deletes a report on live server', { tags: ['live'] }, async ({ project }) => {
	const report = await createReport(project.code)
	const result = await runCommand<MessageResponse>(
		'--project-code',
		project.code,
		'--report-ids',
		report.id
	)
	expect(result).toHaveProperty('message')
})
