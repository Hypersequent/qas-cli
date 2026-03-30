import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { BulkCreateFoldersResponse } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	testBodyInput,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'folders', 'bulk-create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}
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

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { folders: [{ path: ['Suite', 'Auth'] }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ folders: [] }, /Must contain at least one folder/, requiredArgs)
		}
	)
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
