import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TrashEntry } from '../../../api/trash'
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
	runCli<T>('api', 'test-cases', 'delete', ...args)

describe('mocked', () => {
	const trashEntry = { id: 'log1', name: '2 test cases', resourceType: 'test_case' }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/delete`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(trashEntry)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('deletes test cases', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--tcase-ids', '12, tc1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tcaseIds: ['12', 'tc1'] })
		expect(result).toEqual(trashEntry)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tcaseIds: ['12', '13'] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { tcaseIds: ['12'] },
				flags: ['--tcase-ids', '14'],
				expectedRequest: { tcaseIds: ['14'] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ tcaseIds: [] }, /Must contain at least one test case/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--tcase-ids', '12'])

	test('rejects malformed test case references', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12,a/b'),
			/--tcase-ids.*must be comma-separated IDs/
		)
	})

	test('requires test case references or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --tcase-ids is required/
		)
	})
})

test('deletes test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const created = await createTCase(project.code, folder.ids[0][0])
	const result = await runCommand<TrashEntry>(
		'--project-code',
		project.code,
		'--tcase-ids',
		String(created.seq)
	)
	expect(result.resourceType).toBe('test_case')
	expect(result.items.flatMap((item) => item.tcaseIds ?? [])).toContain(created.id)
})
