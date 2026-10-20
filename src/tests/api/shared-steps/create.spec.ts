import { randomBytes } from 'node:crypto'
import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { SharedStep } from '../../../api/shared-steps'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
	testBodyInput,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-steps', 'create', ...args)

describe('mocked', () => {
	const created = { id: 1, title: 'Log in', subSteps: [{ id: 2, description: 'Open' }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/shared-step`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(created, { status: 201 })
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('creates a shared step', async ({ project }) => {
		const subSteps = [{ description: 'Open', expected: 'Opened' }]
		const result = await runCommand(
			'--project-code',
			project.code,
			'--title',
			'Log in',
			'--sub-steps',
			JSON.stringify(subSteps)
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ title: 'Log in', subSteps })
		expect(result).toEqual(created)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Log in', subSteps: [{ description: 'Open' }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--title', 'Log out'],
				expectedRequest: { ...validBody, title: 'Log out' },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ title: 'Log in', subSteps: [] },
				/must have at least one sub-step/,
				requiredArgs
			)
			h.testInvalidBody(
				{ title: 'Log in', subSteps: [{ description: ' ' }, {}] },
				/at least one sub-step must have a description, expected result or data/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--title',
		'Log in',
		'--sub-steps',
		'[{"description": "Open"}]',
	])

	test('requires a title or a body', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ'),
			/Either --body, --body-file, or --title is required/
		)
	})

	test('rejects an empty title', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--title', '', '--sub-steps', '[{}]'),
			/--title.*must not be empty/
		)
	})
})

test('creates a shared step on live server', { tags: ['live'] }, async ({ project }) => {
	const title = `CLI step ${randomBytes(4).toString('hex')}`
	const result = await runCommand<SharedStep>(
		'--project-code',
		project.code,
		'--title',
		title,
		'--sub-steps',
		JSON.stringify([{ description: 'Open the login page', expected: 'The form is shown' }])
	)
	expect(result.title).toBe(title)
	expect(result.subSteps).toHaveLength(1)
})
