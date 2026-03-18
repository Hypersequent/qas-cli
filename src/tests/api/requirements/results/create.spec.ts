import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { CreateResultResponse } from '../../../../api/results'
import type { RunTCase } from '../../../../api/run'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
} from '../../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'results', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/tcase/:tcaseId/result`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ id: 1 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a result', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'1',
			'--tcase-id',
			'tc1',
			'--status',
			'passed'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('1')
		expect(lastParams.tcaseId).toBe('tc1')
		expect(lastRequest).toEqual({ status: 'passed' })
		expect(result).toEqual({ id: 1 })
	})

	test('creates a result with links using text field', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'1',
			'--tcase-id',
			'tc1',
			'--status',
			'passed',
			'--links',
			'[{"text": "CI Log", "url": "https://ci.example.com/123"}]'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('1')
		expect(lastParams.tcaseId).toBe('tc1')
		expect(lastRequest).toEqual({
			status: 'passed',
			links: [{ text: 'CI Log', url: 'https://ci.example.com/123' }],
		})
	})

	test('creates a result with optional fields', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'1',
			'--tcase-id',
			'tc1',
			'--status',
			'failed',
			'--comment',
			'Bug found',
			'--time-taken',
			'5000'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('1')
		expect(lastParams.tcaseId).toBe('tc1')
		expect(lastRequest).toEqual({ status: 'failed', comment: 'Bug found', timeTaken: 5000 })
	})
})

test('creates a requirement result on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0]![0]!
	const tcase = await createTCase(project.code, folderId)
	const runObj = await createRun(project.code, [tcase.id])
	const tcases = await runCli<{ tcases: RunTCase[] }>(
		'api',
		'runs',
		'tcases',
		'list',
		'--project-code',
		project.code,
		'--run-id',
		String(runObj.id)
	)
	const tcaseId = tcases.tcases[0].id
	const result = await runCli<CreateResultResponse>(
		'api',
		'results',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(runObj.id),
		'--tcase-id',
		tcaseId,
		'--status',
		'passed'
	)
	expect(result).toHaveProperty('id')
})
