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

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'test-cases', 'update-version', ...args)

describe('mocked', () => {
	const mockResponse = { message: 'Updated', removed: false }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/tcase/:tcaseId`,
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

	test('moves a run test case to the latest version', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--tcase-id',
			'12',
			'--update-to-latest-version',
			'--allow-run-tcase-removal'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastParams.tcaseId).toBe('12')
		expect(lastRequest).toEqual({ updateToLatestVersion: true, allowRunTCaseRemoval: true })
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { updateToLatestVersion: true }
			const requiredArgs = ['--project-code', 'PRJ', '--run-id', '1', '--tcase-id', '12']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--allow-run-tcase-removal'],
				expectedRequest: { updateToLatestVersion: true, allowRunTCaseRemoval: true },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ updateToLatestVersion: 'yes' },
				/update-to-latest-version|updateToLatestVersion/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--tcase-id',
		'12',
		'--update-to-latest-version',
	])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', [
		'--project-code',
		'PRJ',
		'--run-id',
		'1',
		'--update-to-latest-version',
	])

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1', '--tcase-id', '12'),
			/At least one field to update is required/
		)
	})
})

test(
	'moves a run test case to the latest version on live server',
	{ tags: ['live'] },
	async ({ project }) => {
		const folder = await createFolder(project.code)
		const tcase = await createTCase(project.code, folder.ids[0][0])
		const run = await createRun(project.code, [tcase.id])
		await runCli(
			'api',
			'test-cases',
			'update',
			'--project-code',
			project.code,
			'--tcase-id',
			tcase.id,
			'--title',
			'CLI updated test case'
		)
		const result = await runCommand<{ removed: boolean }>(
			'--project-code',
			project.code,
			'--run-id',
			String(run.id),
			'--tcase-id',
			tcase.id,
			'--update-to-latest-version'
		)
		expect(result.removed).toBe(false)
	}
)
