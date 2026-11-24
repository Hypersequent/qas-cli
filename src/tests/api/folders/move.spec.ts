import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { FolderIdsResponse } from '../../../api/folders'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'folders', 'move', ...args)

describe('mocked', () => {
	const mockResponse = { folders: [{ id: 4 }, { id: 5 }] }

	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/folder/location`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockResponse)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('moves folders', async ({ project }) => {
		const items = [
			{ id: 4, pos: 0 },
			{ id: 5, pos: -1 },
		]
		const result = await runCommand(
			'--project-code',
			project.code,
			'--new-parent-id',
			'10',
			'--items',
			JSON.stringify(items)
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ newParentId: 10, items })
		expect(result).toEqual(mockResponse)
	})

	test('moves folders to the root', async ({ project }) => {
		await runCommand(
			'--project-code',
			project.code,
			'--new-parent-id',
			'0',
			'--items',
			JSON.stringify([{ id: 4, pos: 0 }])
		)
		expect(lastRequest).toEqual({ newParentId: 0, items: [{ id: 4, pos: 0 }] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { newParentId: 10, items: [{ id: 4, pos: 0 }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--new-parent-id', '0'],
				expectedRequest: { newParentId: 0, items: [{ id: 4, pos: 0 }] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ newParentId: 10, items: [] },
				/Must contain at least one item/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--new-parent-id',
		'10',
		'--items',
		JSON.stringify([{ id: 4, pos: 0 }]),
	])

	test('requires items or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--new-parent-id', '10'),
			/Either --body, --body-file, or --items is required/
		)
	})

	test('requires new-parent-id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--items', JSON.stringify([{ id: 4, pos: 0 }])),
			/--new-parent-id/
		)
	})

	test('rejects items that are not an array of positions', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--new-parent-id',
					'10',
					'--items',
					JSON.stringify([{ id: 'x', pos: 0 }])
				),
			/--items\.0\.id/
		)
	})
})

test('moves a folder on live server', { tags: ['live'] }, async ({ project }) => {
	const parentId = (await createFolder(project.code)).ids[0][0]
	const childId = (await createFolder(project.code)).ids[0][0]
	const result = await runCommand<FolderIdsResponse>(
		'--project-code',
		project.code,
		'--new-parent-id',
		String(parentId),
		'--items',
		JSON.stringify([{ id: childId, pos: 0 }])
	)
	expect(result.folders).toEqual([{ id: childId }])
})
