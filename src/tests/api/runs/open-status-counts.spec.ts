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
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'open-status-counts', ...args)

describe('mocked', () => {
	const mockResponse = { items: [{ runId: 42, counts: { open: 1 } }] }
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/run/open-status`,
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

	test('gets the status counts of open runs', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [])
})

test(
	'gets the status counts of open runs on live server',
	{ tags: ['live'] },
	async ({ project }) => {
		const folder = await createFolder(project.code)
		const tcase = await createTCase(project.code, folder.ids[0][0])
		const run = await createRun(project.code, [tcase.id])
		const result = await runCommand<{ items: { runId: number }[] }>('--project-code', project.code)
		expect(result.items.map((i) => i.runId)).toContain(run.id)
	}
)
