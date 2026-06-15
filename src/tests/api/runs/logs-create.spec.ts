import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect, vi } from 'vitest'
import type { CreateRunLogRequest } from '../../../api/runs'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	createRun,
	expectValidationError,
	testRejectsInvalidIdentifier,
	testBodyInput,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'runs', 'logs', 'create', ...args)

describe('mocked', () => {
	let lastBody: CreateRunLogRequest | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/log`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastBody = (await request.json()) as CreateRunLogRequest
				return HttpResponse.json({ id: 'log-1' })
			}
		)
	)

	beforeEach(() => {
		lastBody = null
		lastParams = {}
	})

	test('creates a run log with --comment', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--comment',
			'Deploy finished'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.runId).toBe('42')
		expect(lastBody).toEqual({ comment: 'Deploy finished' })
		expect(result).toEqual({ id: 'log-1' })
	})

	const validBody = { comment: 'Body comment' }

	testBodyInput(
		runCommand,
		() => lastBody,
		(h) => {
			const requiredArgs = ['--project-code', 'PRJ', '--run-id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--comment', 'Overridden'],
				expectedRequest: { comment: 'Overridden' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ comment: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	test('requires --comment, --body, or --body-file', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1'),
			/Either --body, --body-file, or --comment is required/
		)
	})

	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--comment',
		'msg',
	])

	test('rejects empty --comment', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit')
		})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(
				runCommand('--project-code', 'PRJ', '--run-id', '1', '--comment', '')
			).rejects.toThrow('process.exit')
			const errorOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
			expect(errorOutput).toMatch(/--comment.*must not be empty/)
		} finally {
			exitSpy.mockRestore()
			errorSpy.mockRestore()
		}
	})
})

test('creates a run log on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const run = await createRun(project.code, [tcase.id])
	const result = await runCli<{ id: string }>(
		'api',
		'runs',
		'logs',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--comment',
		'CLI live test log'
	)
	expect(result).toHaveProperty('id')
	expect(typeof result.id).toBe('string')
})
