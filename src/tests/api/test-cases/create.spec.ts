import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect, vi, beforeAll, afterAll } from 'vitest'
import { test, baseURL, token, useMockServer, runCli, createFolder } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}
	let tempDir: string

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tcase`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ id: 'tc1', seq: 1 })
			}
		)
	)

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'qas-create-tcase-'))
	})

	afterAll(() => {
		rmSync(tempDir, { recursive: true })
	})

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a test case', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--body',
			'{"title": "Login test", "type": "standalone", "folderId": 1, "priority": "high"}'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Login test',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
		})
		expect(result).toEqual({ id: 'tc1', seq: 1 })
	})

	test('creates a test case with all optional fields using correct field names', async ({
		project,
	}) => {
		const body = JSON.stringify({
			title: 'Full test',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
			comment: 'A description',
			tags: ['smoke', 'regression'],
			isDraft: true,
			steps: [{ description: 'Click button', expected: 'Dialog opens' }],
			precondition: { text: 'User is logged in' },
		})
		await runCommand('--project-code', project.code, '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Full test',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
			comment: 'A description',
			tags: ['smoke', 'regression'],
			isDraft: true,
			steps: [{ description: 'Click button', expected: 'Dialog opens' }],
			precondition: { text: 'User is logged in' },
		})
	})

	test('creates a test case with multiple steps', async ({ project }) => {
		const body = JSON.stringify({
			title: 'Multi-step test',
			type: 'standalone',
			folderId: 1,
			priority: 'medium',
			steps: [
				{ description: 'Navigate to login page', expected: 'Login page is displayed' },
				{ description: 'Enter credentials', expected: 'Fields are filled' },
				{ description: 'Click submit', expected: 'User is logged in' },
			],
		})
		await runCommand('--project-code', project.code, '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'Multi-step test',
			type: 'standalone',
			folderId: 1,
			priority: 'medium',
			steps: [
				{ description: 'Navigate to login page', expected: 'Login page is displayed' },
				{ description: 'Enter credentials', expected: 'Fields are filled' },
				{ description: 'Click submit', expected: 'User is logged in' },
			],
		})
	})

	test('creates a test case with body from @file', async ({ project }) => {
		const filePath = join(tempDir, 'tcase.json')
		writeFileSync(
			filePath,
			JSON.stringify({
				title: 'From file',
				type: 'standalone',
				folderId: 1,
				priority: 'low',
			})
		)
		await runCommand('--project-code', project.code, '--body', `@${filePath}`)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'From file',
			type: 'standalone',
			folderId: 1,
			priority: 'low',
		})
	})

	test('creates a test case with sharedPreconditionId', async ({ project }) => {
		const body = JSON.stringify({
			title: 'With shared precondition',
			type: 'standalone',
			folderId: 1,
			priority: 'medium',
			precondition: { sharedPreconditionId: 42 },
		})
		await runCommand('--project-code', project.code, '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'With shared precondition',
			type: 'standalone',
			folderId: 1,
			priority: 'medium',
			precondition: { sharedPreconditionId: 42 },
		})
	})

	test('creates a test case with requirements and links', async ({ project }) => {
		const body = JSON.stringify({
			title: 'With links',
			type: 'standalone',
			folderId: 1,
			priority: 'low',
			requirements: [{ text: 'REQ-1', url: 'https://example.com/req/1' }],
			links: [{ text: 'Docs', url: 'https://example.com/docs' }],
		})
		await runCommand('--project-code', project.code, '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'With links',
			type: 'standalone',
			folderId: 1,
			priority: 'low',
			requirements: [{ text: 'REQ-1', url: 'https://example.com/req/1' }],
			links: [{ text: 'Docs', url: 'https://example.com/docs' }],
		})
	})

	test('creates a test case using individual fields', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--title',
			'CLI Test',
			'--type',
			'standalone',
			'--folder-id',
			'1',
			'--priority',
			'high'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			title: 'CLI Test',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
		})
	})

	test('individual fields override json body', async ({ project }) => {
		const body = JSON.stringify({
			title: 'From body',
			type: 'standalone',
			folderId: 1,
			priority: 'low',
			comment: 'Body comment',
		})
		await runCommand(
			'--project-code',
			project.code,
			'--body',
			body,
			'--title',
			'Overridden',
			'--priority',
			'high'
		)
		expect(lastRequest).toEqual({
			title: 'Overridden',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
			comment: 'Body comment',
		})
	})

	test('creates a test case with individual fields and --tags, --is-draft, --steps', async ({
		project,
	}) => {
		await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Tagged test',
			'--type',
			'standalone',
			'--folder-id',
			'1',
			'--priority',
			'medium',
			'--tags',
			'smoke,regression',
			'--is-draft',
			'--steps',
			'[{"description": "Step 1", "expected": "Result 1"}]'
		)
		expect(lastRequest).toEqual({
			title: 'Tagged test',
			type: 'standalone',
			folderId: 1,
			priority: 'medium',
			tags: ['smoke', 'regression'],
			isDraft: true,
			steps: [{ description: 'Step 1', expected: 'Result 1' }],
		})
	})
})

test('creates a test case on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const created = await runCommand(
		'--project-code',
		project.code,
		'--body',
		JSON.stringify({
			title: 'Live Test Case',
			type: 'standalone',
			folderId,
			priority: 'medium',
		})
	)
	expect(created).toHaveProperty('id')
	expect(created).toHaveProperty('seq')
})

describe('validation errors', () => {
	const expectValidationError = async (args: string[], expectedPattern: RegExp) => {
		const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
			throw new Error('process.exit')
		})
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
		try {
			await expect(runCli('api', 'test-cases', 'create', ...args)).rejects.toThrow('process.exit')
			const errorOutput = errorSpy.mock.calls.map((c) => c.join(' ')).join('\n')
			expect(errorOutput).toMatch(expectedPattern)
		} finally {
			exitSpy.mockRestore()
			errorSpy.mockRestore()
		}
	}

	test('rejects invalid JSON', async () => {
		await expectValidationError(
			['--project-code', 'PRJ', '--body', 'not-json'],
			/Failed to parse --body as JSON/
		)
	})

	test('rejects missing required fields', async () => {
		await expectValidationError(
			['--project-code', 'PRJ', '--body', '{"title": "Test"}'],
			/Validation failed/
		)
	})
})
