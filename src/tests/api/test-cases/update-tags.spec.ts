import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TCase, TCasesResponse } from '../../../api/tcases'
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
	runCli<T>('api', 'test-cases', 'update-tags', ...args)

describe('mocked', () => {
	const response = { tcases: [{ id: 'tc1', seq: 12 }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/tags`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(response)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('adds and removes tags', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tcase-ids',
			'12,13',
			'--add',
			'smoke, regression',
			'--remove',
			'flaky'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({
			tcaseIds: ['12', '13'],
			add: ['smoke', 'regression'],
			remove: ['flaky'],
		})
		expect(result).toEqual(response)
	})

	test('only adds tags', async () => {
		await runCommand('--project-code', 'PRJ', '--tcase-ids', '12', '--add', 'smoke')
		expect(lastRequest).toEqual({ tcaseIds: ['12'], add: ['smoke'] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tcaseIds: ['12'], add: ['smoke'] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--remove', 'flaky'],
				expectedRequest: { tcaseIds: ['12'], add: ['smoke'], remove: ['flaky'] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ tcaseIds: [], add: ['smoke'] },
				/Must contain at least one test case/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-ids',
		'12',
		'--add',
		'smoke',
	])

	test('requires tags to add or remove', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12'),
			/Either --add or --remove is required/
		)
	})

	test('requires test case references or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--add', 'smoke'),
			/Either --body, --body-file, or --tcase-ids is required/
		)
	})
})

test('adds tags to test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const created = await createTCase(project.code, folder.ids[0][0])
	const result = await runCommand<TCasesResponse>(
		'--project-code',
		project.code,
		'--tcase-ids',
		created.id,
		'--add',
		'cli-smoke'
	)
	expect(result.tcases.map((t) => t.id)).toEqual([created.id])
	const updated = await runCli<TCase>(
		'api',
		'test-cases',
		'get',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id
	)
	expect(updated.tags?.map((t) => t.title)).toContain('cli-smoke')
})
