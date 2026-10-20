import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Tag } from '../../../api/tags'
import type { MessageResponse } from '../../../api/schemas'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'delete', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tag/delete`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ message: 'Tags deleted' })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('deletes tags', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--tag-ids', '1, 2')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tagIds: [1, 2] })
		expect(result).toEqual({ message: 'Tags deleted' })
	})

	test('deletes a single tag', async () => {
		await runCommand('--project-code', 'PRJ', '--tag-ids', '7')
		expect(lastRequest).toEqual({ tagIds: [7] })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tagIds: [1, 2] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { tagIds: [1] },
				flags: ['--tag-ids', '3'],
				expectedRequest: { tagIds: [3] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ tagIds: [] }, /Must contain at least one tag ID/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--tag-ids', '1'])

	test('rejects tag IDs that are not positive integers', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tag-ids', '1,abc'),
			/--tag-ids.*must be comma-separated positive integers/
		)
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tag-ids', '1,0'),
			/--tag-ids.*must be comma-separated positive integers/
		)
	})

	test('requires tag IDs or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --tag-ids is required/
		)
	})
})

test('deletes tags on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Tag>(
		'api',
		'tags',
		'create',
		'--project-code',
		project.code,
		'--title',
		`cli-${randomBytes(4).toString('hex')}`
	)
	const result = await runCommand<MessageResponse>(
		'--project-code',
		project.code,
		'--tag-ids',
		String(created.id)
	)
	expect(result).toHaveProperty('message')
	const remaining = await runCli<Tag[]>('api', 'tags', 'list', '--project-code', project.code)
	expect(remaining.map((t) => t.id)).not.toContain(created.id)
})
