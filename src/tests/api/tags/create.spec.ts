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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(`${baseURL}/api/public/v0/project/:projectCode/tag`, async ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			lastRequest = await request.json()
			return HttpResponse.json({ id: 1, title: 'smoke' }, { status: 201 })
		})
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a tag', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--title', 'smoke')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ title: 'smoke' })
		expect(result).toEqual({ id: 1, title: 'smoke' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'smoke' }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'Original' },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--title', 'smoke'])

	test('rejects an empty title', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', ''),
			/--title.*must not be empty/
		)
	})

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --title is required/
		)
	})
})

test('creates a tag on live server', { tags: ['live'] }, async ({ project }) => {
	const title = `cli-${randomBytes(4).toString('hex')}`
	const created = await runCommand<Tag>('--project-code', project.code, '--title', title)
	expect(created.title).toBe(title)
	expect(typeof created.id).toBe('number')
})
