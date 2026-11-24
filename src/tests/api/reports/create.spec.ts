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
	createFolder,
	createTCase,
	createRun,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'reports', 'create', ...args)

describe('mocked', () => {
	const created = { id: 'r1', seq: 3, name: 'Scorecard', type: 'runScorecard' }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/report`,
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

	test('creates a report of milestones', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--type',
			'runScorecard',
			'--name',
			'Scorecard',
			'--milestone-ids',
			'4, 5'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ type: 'runScorecard', name: 'Scorecard', milestoneIds: [4, 5] })
		expect(result).toEqual(created)
	})

	test('creates a report of runs or of a period', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--type',
			'runComparison',
			'--name',
			'Chrome vs Firefox',
			'--run-ids',
			'11,12'
		)
		expect(lastRequest).toEqual({
			type: 'runComparison',
			name: 'Chrome vs Firefox',
			runIds: [11, 12],
		})

		await runCommand(
			'--project-code',
			'PRJ',
			'--type',
			'tcaseAutomation',
			'--name',
			'October',
			'--start-date',
			'2026-10-01',
			'--end-date',
			'2026-10-31'
		)
		expect(lastRequest).toEqual({
			type: 'tcaseAutomation',
			name: 'October',
			startDate: '2026-10-01',
			endDate: '2026-10-31',
		})
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { type: 'effort', name: 'Effort', runIds: [1] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--name', 'Renamed'],
				expectedRequest: { ...validBody, name: 'Renamed' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ type: 'effort', name: 'Effort', runIds: [1], milestoneIds: [2] },
				/runIds, milestoneIds or a period/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--type',
		'effort',
		'--name',
		'Effort',
	])

	test('requires a type and a name, or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--type', 'effort'),
			/Either --body, --body-file, or --type and --name is required/
		)
	})

	test('rejects a date that is not YYYY-MM-DD', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--type',
					'effort',
					'--name',
					'Effort',
					'--start-date',
					'2026-10-01T00:00:00Z'
				),
			/--start-date.*must be a UTC day as YYYY-MM-DD/
		)
	})

	test('rejects more than one kind of parameter', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--type',
					'effort',
					'--name',
					'Effort',
					'--run-ids',
					'1',
					'--start-date',
					'2026-10-01'
				),
			/runIds, milestoneIds or a period/
		)
	})
})

test('creates a report on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const result = await runCommand<Report>(
		'--project-code',
		project.code,
		'--type',
		'runScorecard',
		'--name',
		'CLI scorecard',
		'--run-ids',
		String(run.id)
	)
	expect(result.name).toBe('CLI scorecard')
	expect(result.parameters.runs?.map((r) => r.id)).toEqual([run.id])
})
