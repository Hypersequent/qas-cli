import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect, beforeAll, afterAll } from 'vitest'
import type { TCase } from '../../../api/tcases'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

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

	test('creates a template test case with custom fields', async ({ project }) => {
		const body = {
			title: 'With custom fields',
			type: 'template',
			folderId: 1,
			priority: 'medium',
			customFields: {
				field1: { isDefault: false, value: 'custom value' },
				field2: { isDefault: true },
			},
		}
		await runCommand('--project-code', project.code, '--body', JSON.stringify(body))
		expect(lastRequest).toEqual(body)
	})

	test('creates a template test case with parameter values', async ({ project }) => {
		const body = {
			title: 'Login ${browser}',
			type: 'template',
			folderId: 1,
			priority: 'medium',
			parameterValues: [
				{ values: { browser: 'Chrome', os: 'Windows' } },
				{ values: { browser: 'Firefox', os: 'Linux' } },
			],
			filledTCaseTitleSuffixParams: ['browser'],
		}
		await runCommand('--project-code', project.code, '--body', JSON.stringify(body))
		expect(lastRequest).toEqual(body)
	})

	test('creates a test case with --custom-fields option', async ({ project }) => {
		const customFields = { field1: { isDefault: false, value: 'test' } }
		await runCommand(
			'--project-code',
			project.code,
			'--title',
			'With CF option',
			'--type',
			'standalone',
			'--folder-id',
			'1',
			'--priority',
			'high',
			'--custom-fields',
			JSON.stringify(customFields)
		)
		expect(lastRequest).toEqual({
			title: 'With CF option',
			type: 'standalone',
			folderId: 1,
			priority: 'high',
			customFields,
		})
	})

	test('creates a template test case with --parameter-values option', async ({ project }) => {
		const parameterValues = [{ values: { browser: 'Chrome' } }]
		await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Login ${browser}',
			'--type',
			'template',
			'--folder-id',
			'1',
			'--priority',
			'high',
			'--parameter-values',
			JSON.stringify(parameterValues)
		)
		expect(lastRequest).toEqual({
			title: 'Login ${browser}',
			type: 'template',
			folderId: 1,
			priority: 'high',
			parameterValues,
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

test(
	'creates a template test case with parameter values on live server',
	{ tags: ['live'] },
	async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const body = {
			title: 'Login ${browser}',
			type: 'template' as const,
			folderId,
			priority: 'medium' as const,
			parameterValues: [{ values: { browser: 'Chrome' } }, { values: { browser: 'Firefox' } }],
			filledTCaseTitleSuffixParams: ['browser'],
		}
		const created = await runCommand<{ id: string; seq: number }>(
			'--project-code',
			project.code,
			'--body',
			JSON.stringify(body)
		)
		const result = await runCli<TCase>(
			'api',
			'test-cases',
			'get',
			'--project-code',
			project.code,
			'--tcase-id',
			created.id
		)
		expect(result.title).toBe(body.title)
		expect(result.folderId).toBe(body.folderId)
		expect(result).toHaveProperty('id')
	}
)

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--body',
		JSON.stringify({ title: 'Test', type: 'standalone', folderId: 1, priority: 'high' }),
	])

	test('rejects invalid JSON', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--body', 'not-json'),
			/Failed to parse --body as JSON/
		)
	})

	test('rejects missing required fields', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--body', '{"title": "Test"}'),
			/Invalid arguments/
		)
	})

	test('rejects parameterValues on standalone test case', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--body',
					JSON.stringify({
						title: 'Test',
						type: 'standalone',
						folderId: 1,
						priority: 'high',
						parameterValues: [{ values: { browser: 'Chrome' } }],
					})
				),
			/--parameter-values.*only allowed for "template"/
		)
	})
})
