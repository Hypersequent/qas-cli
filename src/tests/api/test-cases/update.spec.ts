import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TCase } from '../../../api/tcases'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'update', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/:id`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ message: 'Test case updated' })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('updates a test case with new field names', async ({ project }) => {
		const body = JSON.stringify({
			isDraft: false,
			tags: ['smoke'],
			steps: [{ description: 'Step 1', expected: 'Result 1' }],
			precondition: { text: 'Logged in' },
		})
		await runCommand('--project-code', project.code, '--tcase-id', 'tc1', '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('tc1')
		expect(lastRequest).toEqual({
			isDraft: false,
			tags: ['smoke'],
			steps: [{ description: 'Step 1', expected: 'Result 1' }],
			precondition: { text: 'Logged in' },
		})
	})

	test('updates with --precondition-text', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--precondition-text',
			'User is logged in'
		)
		expect(lastRequest).toEqual({
			precondition: { text: 'User is logged in' },
		})
	})

	test('updates with --precondition-id', async ({ project }) => {
		await runCommand('--project-code', project.code, '--tcase-id', 'tc1', '--precondition-id', '42')
		expect(lastRequest).toEqual({
			precondition: { sharedPreconditionId: 42 },
		})
	})

	test('updates a test case', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--body',
			'{"title": "Updated"}'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('tc1')
		expect(lastRequest).toEqual({ title: 'Updated' })
	})
	test('updates using individual fields', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--title',
			'Updated via CLI'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('tc1')
		expect(lastRequest).toEqual({ title: 'Updated via CLI' })
	})

	test('individual fields override json body', async ({ project }) => {
		const body = JSON.stringify({
			title: 'From body',
			precondition: { text: 'Body precondition' },
			priority: 'low',
		})
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--body',
			body,
			'--title',
			'Overridden',
			'--priority',
			'high'
		)
		expect(lastRequest).toEqual({
			title: 'Overridden',
			precondition: { text: 'Body precondition' },
			priority: 'high',
		})
	})

	test('updates with --tags, --is-draft, --steps', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--title',
			'With extras',
			'--tags',
			'smoke,e2e',
			'--is-draft',
			'--steps',
			'[{"description": "Click", "expected": "Opens"}]'
		)
		expect(lastRequest).toEqual({
			title: 'With extras',
			tags: ['smoke', 'e2e'],
			isDraft: true,
			steps: [{ description: 'Click', expected: 'Opens' }],
		})
	})

	test('updates a test case with custom fields', async ({ project }) => {
		const body = {
			customFields: {
				field1: { isDefault: false, value: 'updated value' },
				field2: { isDefault: true },
			},
		}
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--body',
			JSON.stringify(body)
		)
		expect(lastRequest).toEqual(body)
	})

	test('updates a test case with parameter values', async ({ project }) => {
		const body = {
			parameterValues: [
				{ tcaseId: 'tc-filled-1', values: { browser: 'Chrome' } },
				{ values: { browser: 'Safari' } },
			],
		}
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--body',
			JSON.stringify(body)
		)
		expect(lastRequest).toEqual(body)
	})

	test('updates with --custom-fields option', async ({ project }) => {
		const customFields = { field1: { isDefault: false, value: 'via option' } }
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--custom-fields',
			JSON.stringify(customFields)
		)
		expect(lastRequest).toEqual({ customFields })
	})

	test('updates with --parameter-values option', async ({ project }) => {
		const parameterValues = [{ values: { browser: 'Edge' } }]
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'tc1',
			'--parameter-values',
			JSON.stringify(parameterValues)
		)
		expect(lastRequest).toEqual({ parameterValues })
	})

	test('updates with body from @file', async ({ project }) => {
		const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs')
		const { join } = await import('node:path')
		const { tmpdir } = await import('node:os')
		const tempDir = mkdtempSync(join(tmpdir(), 'qas-update-tcase-'))
		try {
			const filePath = join(tempDir, 'update.json')
			writeFileSync(filePath, JSON.stringify({ title: 'From file', priority: 'high' }))
			await runCommand(
				'--project-code',
				project.code,
				'--tcase-id',
				'tc1',
				'--body',
				`@${filePath}`
			)
			expect(lastRequest).toEqual({ title: 'From file', priority: 'high' })
		} finally {
			rmSync(tempDir, { recursive: true })
		}
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-id',
		'tc1',
		'--body',
		JSON.stringify({ title: 'Updated' }),
	])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', [
		'--project-code',
		'PRJ',
		'--body',
		JSON.stringify({ title: 'Updated' }),
	])

	test('rejects --precondition-text and --precondition-id together', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--tcase-id',
					'tc1',
					'--precondition-text',
					'Some text',
					'--precondition-id',
					'42'
				),
			/--precondition-text and --precondition-id are mutually exclusive/
		)
	})
})

test(
	'updates a template test case with parameter values on live server',
	{ tags: ['live'] },
	async ({ project }) => {
		const folder = await createFolder(project.code)
		const folderId = folder.ids[0][0]
		const createBody = {
			title: 'Template ${env}',
			type: 'template' as const,
			folderId,
			priority: 'medium' as const,
			parameterValues: [{ values: { env: 'staging' } }],
			filledTCaseTitleSuffixParams: ['env'],
		}
		const created = await runCli<{ id: string; seq: number }>(
			'api',
			'test-cases',
			'create',
			'--project-code',
			project.code,
			'--body',
			JSON.stringify(createBody)
		)
		const updatedParams = [{ values: { env: 'staging' } }, { values: { env: 'production' } }]
		await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			created.id,
			'--parameter-values',
			JSON.stringify(updatedParams)
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
		expect(result.title).toBe(createBody.title)
		expect(result.folderId).toBe(createBody.folderId)
	}
)

test('updates a test case on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const created = await createTCase(project.code, folderId)
	const updateResult = await runCommand<{ message: string }>(
		'--project-code',
		project.code,
		'--tcase-id',
		created.id,
		'--body',
		JSON.stringify({ title: 'Updated Title' })
	)
	expect(typeof updateResult.message).toBe('string')

	const result = await runCli<TCase>(
		'api',
		'test-cases',
		'get',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id
	)
	expect(result.title).toBe('Updated Title')
})
