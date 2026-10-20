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

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'tags', 'update', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tag/:tagId`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json({ id: 7, title: 'regression' })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('renames a tag', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tag-id',
			'7',
			'--title',
			'regression'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.tagId).toBe('7')
		expect(lastRequest).toEqual({ title: 'regression' })
		expect(result).toEqual({ id: 7, title: 'regression' })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'regression' }
			const requiredArgs = ['--project-code', 'PRJ', '--tag-id', '7']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tag-id',
		'7',
		'--title',
		'regression',
	])

	test('rejects a non-positive tag ID', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tag-id', '0', '--title', 'regression'),
			/--tag-id.*must be a positive integer/
		)
	})

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tag-id', '7'),
			/Either --body, --body-file, or --title is required/
		)
	})
})

test('renames a tag on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Tag>(
		'api',
		'tags',
		'create',
		'--project-code',
		project.code,
		'--title',
		`cli-${randomBytes(4).toString('hex')}`
	)
	const title = `cli-${randomBytes(4).toString('hex')}`
	const renamed = await runCommand<Tag>(
		'--project-code',
		project.code,
		'--tag-id',
		String(created.id),
		'--title',
		title
	)
	expect(renamed).toEqual({ id: created.id, title })
})
