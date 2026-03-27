import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, beforeAll, afterAll, describe, expect } from 'vitest'
import type { BulkCreateFoldersResponse } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'folders', 'bulk-create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}
	let tempDir: string

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/folder/bulk`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ ids: [[1]] })
			}
		)
	)

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'qas-bulk-create-'))
	})

	afterAll(() => {
		rmSync(tempDir, { recursive: true })
	})

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('bulk creates folders', async ({ project }) => {
		const request = [{ path: ['Suite', 'Auth'] }]
		const result = await runCommand(
			'--project-code',
			project.code,
			'--folders',
			JSON.stringify(request)
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ folders: request })
		expect(result).toEqual({ ids: [[1]] })
	})

	test('bulk creates folders from @file', async ({ project }) => {
		const filePath = join(tempDir, 'folders.json')
		writeFileSync(filePath, JSON.stringify([{ path: ['FromFile', 'Nested'] }]))
		await runCommand('--project-code', project.code, '--folders', `@${filePath}`)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ folders: [{ path: ['FromFile', 'Nested'] }] })
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--folders',
		JSON.stringify([{ path: ['Suite'] }]),
	])
})

test('bulk creates folders on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<BulkCreateFoldersResponse>(
		'--project-code',
		project.code,
		'--folders',
		JSON.stringify([{ path: ['LiveTest', 'Auth'] }])
	)
	expect(result).toHaveProperty('ids')
	expect(Array.isArray(result.ids)).toBe(true)
})
