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
			comment: 'Updated comment',
			isDraft: false,
			tags: ['smoke'],
			steps: [{ description: 'Step 1', expected: 'Result 1' }],
			precondition: { text: 'Logged in' },
		})
		await runCommand('--project-code', project.code, '--tcase-id', 'tc1', '--body', body)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('tc1')
		expect(lastRequest).toEqual({
			comment: 'Updated comment',
			isDraft: false,
			tags: ['smoke'],
			steps: [{ description: 'Step 1', expected: 'Result 1' }],
			precondition: { text: 'Logged in' },
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
			comment: 'Body comment',
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
			comment: 'Body comment',
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

test('updates a test case on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const created = await createTCase(project.code, folderId)
	await runCommand(
		'--project-code',
		project.code,
		'--tcase-id',
		created.id,
		'--body',
		JSON.stringify({ title: 'Updated Title' })
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
	expect(result.title).toBe('Updated Title')
})
