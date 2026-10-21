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
	runCli<T>('api', 'test-cases', 'update-priority', ...args)

describe('mocked', () => {
	const response = { tcases: [{ id: 'tc1', seq: 12 }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/priority`,
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

	test('sets the priority of test cases', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tcase-ids',
			'12,13',
			'--priority',
			'high'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tcaseIds: ['12', '13'], priority: 'high' })
		expect(result).toEqual(response)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tcaseIds: ['12'], priority: 'low' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--priority', 'medium'],
				expectedRequest: { tcaseIds: ['12'], priority: 'medium' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ tcaseIds: ['12'], priority: 'urgent' }, /priority/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-ids',
		'12',
		'--priority',
		'high',
	])

	test('rejects an unknown priority', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12', '--priority', 'urgent'),
			/priority/
		)
	})

	test('requires the test cases and the priority', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--priority', 'high'),
			/Either --body, --body-file, or --tcase-ids and --priority is required/
		)
	})
})

test('sets the priority of test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const created = await createTCase(project.code, folder.ids[0][0])
	const result = await runCommand<TCasesResponse>(
		'--project-code',
		project.code,
		'--tcase-ids',
		created.id,
		'--priority',
		'high'
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
	expect(updated.priority).toBe('high')
})
