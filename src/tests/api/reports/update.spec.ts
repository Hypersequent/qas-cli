import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { Report } from '../../../api/reports'
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
	runCli<T>('api', 'reports', 'update', ...args)

describe('mocked', () => {
	const updated = { id: 'r1', seq: 3, name: 'Release 2.4', type: 'runScorecard' }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/report/:reportId`,
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

	test('renames a report', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--report-id',
			'3',
			'--name',
			'Release 2.4'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.reportId).toBe('3')
		expect(lastRequest).toEqual({ name: 'Release 2.4' })
		expect(result).toEqual(updated)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { name: 'Release 2.4' }
			const requiredArgs = ['--project-code', 'PRJ', '--report-id', '3']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--name', 'Release 2.5'],
				expectedRequest: { name: 'Release 2.5' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ name: 'x'.repeat(256) }, /at most 255 characters/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'report-id', 'resource', [
		'--project-code',
		'PRJ',
		'--name',
		'Release',
	])

	test('requires a name or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--report-id', '3'),
			/Either --body, --body-file, or --name is required/
		)
	})

	test('rejects an empty name', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--report-id', '3', '--name', ''),
			/--name.*must not be empty/
		)
	})
})

test('renames a report on live server', { tags: ['live'] }, async ({ project }) => {
	const report = await createReport(project.code)
	const result = await runCommand<Report>(
		'--project-code',
		project.code,
		'--report-id',
		report.id,
		'--name',
		`${report.name} renamed`
	)
	expect(result.name).toBe(`${report.name} renamed`)
})
