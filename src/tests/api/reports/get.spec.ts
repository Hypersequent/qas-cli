import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Report } from '../../../api/reports'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createReport,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'reports', 'get', ...args)

describe('mocked', () => {
	const mockResponse = {
		id: 'r1',
		seq: 3,
		name: 'Scorecard',
		type: 'runScorecard',
		runs: [{ id: 11, title: 'Regression', configuration: null }],
	}
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/report/:reportId`,
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

	test('gets a report by sequence number', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--report-id', '3')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.reportId).toBe('3')
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--report-id', '3'])
	testRejectsInvalidIdentifier(runCommand, 'report-id', 'resource', ['--project-code', 'PRJ'])
})

test('gets a report on live server', { tags: ['live'] }, async ({ project }) => {
	const report = await createReport(project.code)
	const result = await runCommand<Report>(
		'--project-code',
		project.code,
		'--report-id',
		String(report.seq)
	)
	expect(result.id).toBe(report.id)
	expect(result.runs).toHaveLength(1)
})
