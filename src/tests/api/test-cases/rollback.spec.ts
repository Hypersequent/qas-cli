import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { TCase } from '../../../api/tcases'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	testRejectsInvalidIdentifier,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'rollback', ...args)

describe('mocked', () => {
	const mockTCase = { id: 'tc1', title: 'Login test', version: 3 }
	let lastParams: PathParams = {}

	useMockServer(
		http.post(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/:id/version/:version/rollback`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockTCase)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('rolls a test case back to a version', async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tcase-id',
			'12',
			'--tcase-version',
			'1'
		)
		expect(lastParams).toEqual({ projectCode: project.code, id: '12', version: '1' })
		expect(result).toEqual(mockTCase)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-id',
		'tc1',
		'--tcase-version',
		'1',
	])
	testRejectsInvalidIdentifier(runCommand, 'tcase-id', 'resource', [
		'--project-code',
		'PRJ',
		'--tcase-version',
		'1',
	])

	test('rejects a version that is not a positive integer', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-id', 'tc1', '--tcase-version', '-1'),
			/--tcase-version.*must be a positive integer/
		)
	})
})

test('rolls a test case back on live server', { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const created = await createTCase(project.code, folder.ids[0][0])
	const original = await runCli<TCase>(
		'api',
		'test-cases',
		'get',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id
	)
	await runCli(
		'api',
		'test-cases',
		'update',
		'--project-code',
		project.code,
		'--tcase-id',
		created.id,
		'--title',
		`${original.title} (edited)`
	)
	const result = await runCommand<TCase>(
		'--project-code',
		project.code,
		'--tcase-id',
		created.id,
		'--tcase-version',
		'1'
	)
	expect(result.title).toBe(original.title)
	expect(result.version).toBe(3)
})
