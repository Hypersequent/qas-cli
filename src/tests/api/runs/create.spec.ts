import { writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { CreateRunRequest, CreateRunResponse } from '../../../api/runs'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'runs', 'create', ...args)

describe('mocked', () => {
	let lastCreateRunRequest: CreateRunRequest | null = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(`${baseURL}/api/public/v0/project/:projectCode/run`, async ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastParams = params
			lastCreateRunRequest = (await request.json()) as CreateRunRequest
			return HttpResponse.json({ id: 42 })
		})
	)

	beforeEach(() => {
		lastCreateRunRequest = null
		lastParams = {}
	})

	describe('successful requests', () => {
		test('creates a static run with tcaseIds', async ({ project }) => {
			const result = await runCommand(
				'--project-code',
				project.code,
				'--title',
				'Sprint 1',
				'--type',
				'static',
				'--query-plans',
				'[{"tcaseIds": ["abc", "def"]}]'
			)

			expect(lastParams.projectCode).toBe(project.code)
			expect(lastCreateRunRequest).toEqual({
				title: 'Sprint 1',
				type: 'static',
				queryPlans: [{ tcaseIds: ['abc', 'def'] }],
			})
			expect(result).toEqual({ id: 42 })
		})

		test('creates a static_struct run with folderIds and priorities', async ({ project }) => {
			await runCommand(
				'--project-code',
				project.code,
				'--title',
				'Structured Run',
				'--type',
				'static_struct',
				'--query-plans',
				'[{"folderIds": [1, 2], "priorities": ["high"]}]'
			)

			expect(lastParams.projectCode).toBe(project.code)
			expect(lastCreateRunRequest).toEqual({
				title: 'Structured Run',
				type: 'static_struct',
				queryPlans: [{ folderIds: [1, 2], priorities: ['high'] }],
			})
		})

		test('creates a live run with multiple query plans', async ({ project }) => {
			await runCommand(
				'--project-code',
				project.code,
				'--title',
				'Live Run',
				'--type',
				'live',
				'--query-plans',
				'[{"folderIds": [1]}, {"tagIds": [10], "priorities": ["low"]}]'
			)

			expect(lastParams.projectCode).toBe(project.code)
			expect(lastCreateRunRequest).toEqual({
				title: 'Live Run',
				type: 'live',
				queryPlans: [{ folderIds: [1] }, { tagIds: [10], priorities: ['low'] }],
			})
		})

		test('reads --query-plans from a file using @filename', async ({ project }) => {
			const tmpDir = mkdtempSync(join(tmpdir(), 'qas-test-'))
			const filePath = join(tmpDir, 'plans.json')
			writeFileSync(filePath, JSON.stringify([{ tcaseIds: ['x1', 'x2'] }]))

			try {
				const result = await runCommand(
					'--project-code',
					project.code,
					'--title',
					'From File',
					'--type',
					'static',
					'--query-plans',
					`@${filePath}`
				)

				expect(lastParams.projectCode).toBe(project.code)
				expect(lastCreateRunRequest).toEqual({
					title: 'From File',
					type: 'static',
					queryPlans: [{ tcaseIds: ['x1', 'x2'] }],
				})
				expect(result).toEqual({ id: 42 })
			} finally {
				rmSync(tmpDir, { recursive: true })
			}
		})

		test('includes optional milestone-id, configuration-id, and assignment-id', async ({
			project,
		}) => {
			await runCommand(
				'--project-code',
				project.code,
				'--title',
				'With Options',
				'--type',
				'static',
				'--milestone-id',
				'5',
				'--configuration-id',
				'cfg-1',
				'--assignment-id',
				'10',
				'--query-plans',
				'[{"tcaseIds": ["abc"]}]'
			)

			expect(lastParams.projectCode).toBe(project.code)
			expect(lastCreateRunRequest).toEqual({
				title: 'With Options',
				type: 'static',
				milestoneId: 5,
				configurationId: 'cfg-1',
				assignmentId: 10,
				queryPlans: [{ tcaseIds: ['abc'] }],
			})
		})

		test('includes optional description', async ({ project }) => {
			await runCommand(
				'--project-code',
				project.code,
				'--title',
				'With Description',
				'--type',
				'static',
				'--description',
				'Some description',
				'--query-plans',
				'[{"tcaseIds": ["abc"]}]'
			)

			expect(lastParams.projectCode).toBe(project.code)
			expect(lastCreateRunRequest).toEqual({
				title: 'With Description',
				type: 'static',
				description: 'Some description',
				queryPlans: [{ tcaseIds: ['abc'] }],
			})
		})
	})
})

describe('validation errors', () => {
	test('rejects empty title', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'',
					'--type',
					'static',
					'--query-plans',
					'[{"tcaseIds": ["abc"]}]'
				),
			/--title.*must not be empty/
		)
	})

	test('rejects title exceeding 255 characters', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'x'.repeat(256),
					'--type',
					'static',
					'--query-plans',
					'[{"tcaseIds": ["abc"]}]'
				),
			/--title.*must be at most 255 characters/
		)
	})

	test('rejects description exceeding 512 characters', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Valid',
					'--type',
					'static',
					'--description',
					'x'.repeat(513),
					'--query-plans',
					'[{"tcaseIds": ["abc"]}]'
				),
			/--description.*must be at most 512 characters/
		)
	})

	test('rejects invalid JSON in --query-plans', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'not-json'
				),
			/Failed to parse --query-plans as JSON/
		)
	})

	test('rejects empty query plans array', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[]'
				),
			/Must contain at least one query plan/
		)
	})

	test('rejects empty query plan object', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[{}]'
				),
			/must specify at least one filter/
		)
	})

	test('rejects unknown keys in query plan (strict mode)', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[{"unknownKey": true}]'
				),
			/Unrecognized key/
		)
	})

	test('rejects invalid priority values', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[{"priorities": ["critical"]}]'
				),
			/Invalid enum value.*Expected 'low' \| 'medium' \| 'high'/
		)
	})

	test('rejects tcaseIds in live runs', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'live',
					'--query-plans',
					'[{"tcaseIds": ["abc"]}]'
				),
			/tcaseIds is not allowed for "live" runs/
		)
	})

	test('rejects multiple query plans for static runs', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[{"tcaseIds": ["abc"]}, {"folderIds": [1]}]'
				),
			/supports exactly one query plan/
		)
	})

	test('rejects multiple query plans for static_struct runs', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static_struct',
					'--query-plans',
					'[{"tcaseIds": ["abc"]}, {"folderIds": [1]}]'
				),
			/supports exactly one query plan/
		)
	})

	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--title',
		'Test',
		'--type',
		'static',
		'--query-plans',
		JSON.stringify([{ tcaseIds: ['abc'] }]),
	])

	test('rejects non-integer folderIds', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--title',
					'Test',
					'--type',
					'static',
					'--query-plans',
					'[{"folderIds": [1.5]}]'
				),
			/integer/
		)
	})
})

test('creates a run on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const folderId = folder.ids[0][0]
	const tcase = await createTCase(project.code, folderId)
	const created = await runCli<CreateRunResponse>(
		'api',
		'runs',
		'create',
		'--project-code',
		project.code,
		'--title',
		'Live Run',
		'--type',
		'static',
		'--query-plans',
		JSON.stringify([{ tcaseIds: [tcase.id] }])
	)
	expect(created).toHaveProperty('id')
	expect(typeof created.id).toBe('number')
})
