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
	runCli<T>('api', 'test-cases', 'move', ...args)

describe('mocked', () => {
	const response = { tcases: [{ id: 'tc1', seq: 12 }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/location`,
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

	test('moves test cases to a folder', async ({ project }) => {
		const items = [
			{ id: '12', pos: 0 },
			{ id: '13', pos: -1 },
		]
		const result = await runCommand(
			'--project-code',
			project.code,
			'--new-parent-id',
			'5',
			'--items',
			JSON.stringify(items)
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ newParentId: 5, items })
		expect(result).toEqual(response)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { newParentId: 5, items: [{ id: '12', pos: 0 }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--new-parent-id', '6'],
				expectedRequest: { newParentId: 6, items: [{ id: '12', pos: 0 }] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ newParentId: 5, items: [] },
				/Must contain at least one item/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--new-parent-id',
		'5',
		'--items',
		JSON.stringify([{ id: '12', pos: 0 }]),
	])

	test('rejects items without a position', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--new-parent-id',
					'5',
					'--items',
					JSON.stringify([{ id: '12' }])
				),
			/--items\.0\.pos/
		)
	})

	test('requires the folder and the items', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--new-parent-id', '5'),
			/Either --body, --body-file, or --new-parent-id and --items is required/
		)
	})
})

test('moves test cases on live server', { tags: ['live'] }, async ({ project }) => {
	const source = await createFolder(project.code)
	const target = await createFolder(project.code)
	const targetId = target.ids[0][0]
	const created = await createTCase(project.code, source.ids[0][0])
	const result = await runCommand<TCasesResponse>(
		'--project-code',
		project.code,
		'--new-parent-id',
		String(targetId),
		'--items',
		JSON.stringify([{ id: created.id, pos: 0 }])
	)
	expect(result.tcases.map((t) => t.id)).toEqual([created.id])
	const moved = await runCli<TCase>(
		'api',
		'test-cases',
		'get',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id
	)
	expect(moved.folderId).toBe(targetId)
})
