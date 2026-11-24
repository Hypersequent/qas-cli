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
	createMilestone,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'move', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'Runs moved' }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/run/milestone`,
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

	test('moves runs into a milestone', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-ids',
			'1,2',
			'--milestone-id',
			'5'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ runIds: [1, 2], milestoneId: 5 })
		expect(result).toEqual(mockResponse)
	})

	test('takes runs out of their milestone with 0', async ({ project }) => {
		await runCommand('--project-code', project.code, '--run-ids', '1', '--milestone-id', '0')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ runIds: [1], milestoneId: 0 })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { runIds: [1], milestoneId: 5 }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--milestone-id', '6'],
				expectedRequest: { runIds: [1], milestoneId: 6 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ runIds: [1], milestoneId: -1 },
				/milestoneId must be a non-negative integer/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-ids',
		'1',
		'--milestone-id',
		'5',
	])

	test('requires run IDs and a milestone', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-ids', '1'),
			/Either --body, --body-file, or --run-ids and --milestone-id is required/
		)
	})
})

test('moves a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const milestone = await createMilestone(project.code)
	await runCommand(
		'--project-code',
		project.code,
		'--run-ids',
		String(run.id),
		'--milestone-id',
		String(milestone.id)
	)
	const moved = await runCli<{ milestoneId: number | null }>(
		'api',
		'runs',
		'get',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(moved.milestoneId).toBe(milestone.id)
})
