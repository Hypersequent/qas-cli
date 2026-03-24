import type { CloneRunResponse } from '../../../api/runs'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
	testRejectsInvalidPathParam,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'clone', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/clone`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ id: 99 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('clones a run', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--title',
			'Cloned Run'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ runId: 42, title: 'Cloned Run' })
		expect(result).toEqual({ id: 99 })
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code', ['--run-id', '1', '--title', 'Test'])

	test('rejects empty title', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit')
		})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(
				runCommand('--project-code', 'PRJ', '--run-id', '42', '--title', '')
			).rejects.toThrow('process.exit')
			const errorOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
			expect(errorOutput).toMatch(/--title must not be empty/)
		} finally {
			exitSpy.mockRestore()
			errorSpy.mockRestore()
		}
	})
})

test('clones a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const cloned = await runCli<CloneRunResponse>(
		'api',
		'runs',
		'clone',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--title',
		'Cloned Run'
	)
	expect(cloned).toHaveProperty('id')
	expect(cloned.id).not.toBe(run.id)
})
