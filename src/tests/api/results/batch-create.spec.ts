import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { RunTCase } from '../../../api/runs'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'results', 'batch-create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/result/batch`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ ids: [1, 2] })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('batch creates results with links', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--run-id',
			'1',
			'--items',
			'[{"tcaseId": "tc1", "status": "passed", "links": [{"text": "Log", "url": "https://ci.example.com/1"}]}]'
		)
		expect(lastParams.projectCode).toBe('PRJ')
		expect(lastParams.runId).toBe('1')
		expect(lastRequest).toEqual({
			items: [
				{
					tcaseId: 'tc1',
					status: 'passed',
					links: [{ text: 'Log', url: 'https://ci.example.com/1' }],
				},
			],
		})
	})

	test('batch creates results', async () => {
		const result = await runCommand(
			'--project-code',
			'PRJ',
			'--run-id',
			'1',
			'--items',
			'[{"tcaseId": "tc1", "status": "passed"}, {"tcaseId": "tc2", "status": "failed"}]'
		)
		expect(lastParams.projectCode).toBe('PRJ')
		expect(lastParams.runId).toBe('1')
		expect(lastRequest).toEqual({
			items: [
				{ tcaseId: 'tc1', status: 'passed' },
				{ tcaseId: 'tc2', status: 'failed' },
			],
		})
		expect(result).toEqual({ ids: [1, 2] })
	})
})

test('batch creates results on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const runObj = await createRun(project.code, [tcase.id])
	const tcases = await runCli<RunTCase[]>(
		'api',
		'runs',
		'tcases',
		'list',
		'--project-code',
		project.code,
		'--run-id',
		String(runObj.id)
	)
	const tcaseId = tcases[0].id
	const result = await runCli<{ ids: number[] }>(
		'api',
		'results',
		'batch-create',
		'--project-code',
		project.code,
		'--run-id',
		String(runObj.id),
		'--items',
		JSON.stringify([{ tcaseId, status: 'passed' }])
	)
	expect(result).toHaveProperty('ids')
	expect(Array.isArray(result.ids)).toBe(true)
})
