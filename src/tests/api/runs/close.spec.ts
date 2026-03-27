import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
	testRejectsInvalidIdentifier,
} from '../test-helper'
import { MessageResponse } from '../../../api/schemas'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'close', ...args)

const expectedResponse = { message: 'Run closed' }

describe('mocked', () => {
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/close`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				return HttpResponse.json({ message: 'Run closed' })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('closes a run', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--run-id', '42')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(result).toEqual(expectedResponse)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--run-id', '1'])
})

test('closes a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const result = await runCli<MessageResponse>(
		'api',
		'runs',
		'close',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id)
	)
	expect(result).toEqual(expectedResponse)
})
