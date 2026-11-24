import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Tag } from '../../../api/tags'
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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'rename', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(`${baseURL}/api/public/v0/project/:projectCode/tag`, async ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			const body = (await request.json()) as { tags: Tag[] }
			lastRequest = body
			return HttpResponse.json(body)
		})
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('renames several tags', async ({ project }) => {
		const tags = [
			{ id: 1, title: 'smoke' },
			{ id: 2, title: 'e2e' },
		]
		const result = await runCommand('--project-code', project.code, '--tags', JSON.stringify(tags))
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tags })
		expect(result).toEqual({ tags })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tags: [{ id: 1, title: 'smoke' }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ tags: [] }, /Must contain at least one tag/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tags',
		JSON.stringify([{ id: 1, title: 'smoke' }]),
	])

	test('rejects --tags that is not JSON', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tags', 'smoke'),
			/Failed to parse --tags as JSON/
		)
	})

	test('rejects a tag with an empty title', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tags', JSON.stringify([{ id: 1, title: '' }])),
			/--tags\.0\.title.*must not be empty/
		)
	})

	test('requires tags or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --tags is required/
		)
	})
})

test('renames several tags on live server', { tags: ['live'] }, async ({ project }) => {
	const createTag = () =>
		runCli<Tag>(
			'api',
			'tags',
			'create',
			'--project-code',
			project.code,
			'--title',
			`cli-${randomBytes(4).toString('hex')}`
		)
	const first = await createTag()
	const second = await createTag()
	const tags = [
		{ id: first.id, title: `cli-${randomBytes(4).toString('hex')}` },
		{ id: second.id, title: `cli-${randomBytes(4).toString('hex')}` },
	]
	const result = await runCommand<{ tags: Tag[] }>(
		'--project-code',
		project.code,
		'--tags',
		JSON.stringify(tags)
	)
	expect(result.tags).toEqual(tags)
})
