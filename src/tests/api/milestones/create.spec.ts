import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect, vi } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidPathParam,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'milestones', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/milestone`,
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

	test('creates a milestone', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--title', 'v1.0')
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual({ id: 1 })
		expect(lastRequest).toEqual({ title: 'v1.0' })
	})
})

describe('validation errors', () => {
	testRejectsInvalidPathParam(runCommand, 'project-code', ['--title', 'Test'])

	test('rejects empty title', async () => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit')
		})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(runCommand('--project-code', 'PRJ', '--title', '')).rejects.toThrow(
				'process.exit'
			)
			const errorOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
			expect(errorOutput).toMatch(/--title must not be empty/)
		} finally {
			exitSpy.mockRestore()
			errorSpy.mockRestore()
		}
	})
})

test('creates a milestone on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<{ id: number }>(
		'api',
		'milestones',
		'create',
		'--project-code',
		project.code,
		'--title',
		'v1.0'
	)
	expect(created).toHaveProperty('id')
	expect(typeof created.id).toBe('number')
})
