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
	runCli<T>('api', 'shared-steps', 'update', ...args)

describe('mocked', () => {
	const updated = { id: 1, title: 'Log in as admin', subSteps: [{ id: 2, description: 'Open' }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/shared-step/:id`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(updated)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('renames a shared step', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--id',
			'1',
			'--title',
			'Log in as admin'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('1')
		expect(lastRequest).toEqual({ title: 'Log in as admin' })
		expect(result).toEqual(updated)
	})

	test('replaces the sub-steps, keeping those with an id', async ({ project }) => {
		const subSteps = [{ id: 2, description: 'Open' }, { description: 'New step' }]
		await runCommand(
			'--project-code',
			project.code,
			'--id',
			'1',
			'--sub-steps',
			JSON.stringify(subSteps)
		)
		expect(lastRequest).toEqual({ subSteps })
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { title: 'Log in as admin' }
			const requiredArgs = ['--project-code', 'PRJ', '--id', '1']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: { title: 'From body', subSteps: [{ id: 2 }] },
				flags: ['--title', 'Overridden'],
				expectedRequest: { title: 'Overridden', subSteps: [{ id: 2 }] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody({ title: '' }, /must not be empty/, requiredArgs)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--id', '1', '--title', 'X'])

	test('rejects a non-positive id', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--id', '0', '--title', 'X'),
			/--id.*must be a positive integer/
		)
	})

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--id', '1'),
			/At least one field to update is required/
		)
	})
})

test('updates a shared step on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<SharedStep>(
		'api',
		'shared-steps',
		'create',
		'--project-code',
		project.code,
		'--title',
		`CLI step ${randomBytes(4).toString('hex')}`,
		'--sub-steps',
		JSON.stringify([{ description: 'Open' }])
	)
	const title = `CLI step ${randomBytes(4).toString('hex')}`
	const result = await runCommand<SharedStep>(
		'--project-code',
		project.code,
		'--id',
		String(created.id),
		'--title',
		title
	)
	expect(result.id).toBe(created.id)
	expect(result.title).toBe(title)
})
