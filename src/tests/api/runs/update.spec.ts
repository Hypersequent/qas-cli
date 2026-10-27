import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createFolder,
	createTCase,
	createRun,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'update', ...args)

describe('mocked', () => {
	const mockResponse = { id: 42, title: 'Sprint 2', type: 'static', closedAt: null }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId`,
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

	test('updates a run, taking it out of its milestone', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--title',
			'Sprint 2',
			'--milestone-id',
			'0',
			'--configuration-id',
			'',
			'--integration-issue-id',
			'QA-12'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastRequest).toEqual({
			title: 'Sprint 2',
			milestoneId: 0,
			configurationId: '',
			integrationIssueId: 'QA-12',
		})
		expect(result).toEqual(mockResponse)
	})

	test('replaces the selection, keeping a query plan by id', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--type',
			'live',
			'--query-plans',
			'[{"id": 3, "tagIds": [1]}, {"folderIds": [2]}]'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			type: 'live',
			queryPlans: [{ id: 3, tagIds: [1] }, { folderIds: [2] }],
		})
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Sprint 2' }
			const requiredArgs = ['--project-code', 'PRJ', '--run-id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--milestone-id', '5'],
				expectedRequest: { title: 'Sprint 2', milestoneId: 5 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--title',
		'X',
	])

	test('rejects a non-positive run-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', 'X', '--run-id', '0'),
			/--run-id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1'),
			/At least one field to update is required/
		)
	})

	test('rejects tcaseIds beside another query plan', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--run-id',
					'1',
					'--query-plans',
					'[{"id": 3, "tcaseIds": ["abc"]}, {"folderIds": [2]}]'
				),
			/--query-plans.*tcaseIds are only allowed in a single query plan/
		)
	})
})

test('updates a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const result = await runCommand<{ id: number; title: string }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--title',
		'CLI updated run'
	)
	expect(result.id).toBe(run.id)
	expect(result.title).toBe('CLI updated run')
})
