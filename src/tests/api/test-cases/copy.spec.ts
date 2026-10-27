import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TCasesResponse } from '../../../api/tcases'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'copy', ...args)

describe('mocked', () => {
	const response = { tcases: [{ id: 'tc9', seq: 9 }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/copy`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(response, { status: 201 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('copies test cases into a folder', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tcase-ids',
			'12,13',
			'--target-folder-id',
			'5'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tcaseIds: ['12', '13'], targetFolderId: 5 })
		expect(result).toEqual(response)
	})

	test('copies test cases from another project', async () => {
		await runCommand(
			'--project-code',
			'PRJ',
			'--tcase-ids',
			'4',
			'--target-folder-id',
			'5',
			'--source-project-id',
			'OLD'
		)
		expect(lastRequest).toEqual({ tcaseIds: ['4'], targetFolderId: 5, sourceProjectId: 'OLD' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tcaseIds: ['12'], targetFolderId: 5 }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--target-folder-id', '6'],
				expectedRequest: { tcaseIds: ['12'], targetFolderId: 6 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ tcaseIds: ['12'] }, /targetFolderId|expected number/i, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-ids',
		'12',
		'--target-folder-id',
		'5',
	])

	test('rejects a target folder that is not a positive integer', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12', '--target-folder-id', '0'),
			/--target-folder-id.*must be a positive integer/
		)
	})

	test('requires the test cases and the target folder', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12'),
			/Either --body, --body-file, or --tcase-ids and --target-folder-id is required/
		)
	})
})

test('copies test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const created = await createTCase(project.code, folderId)
	const result = await runCommand<TCasesResponse>(
		'--project-code',
		project.code,
		'--tcase-ids',
		created.id,
		'--target-folder-id',
		String(folderId)
	)
	expect(result.tcases).toHaveLength(1)
	expect(result.tcases[0].id).not.toBe(created.id)
})
