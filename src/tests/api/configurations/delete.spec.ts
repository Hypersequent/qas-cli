import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { Configuration } from '../../../api/configurations'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'configurations', 'delete', ...args)

describe('mocked', () => {
	let lastParams: PathParams = {}

	useMockServer(
		http.delete(
			`${baseURL}/api/public/v0/project/:projectCode/configuration/:id`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json({ message: 'Configuration deleted' })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('deletes a configuration', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--configuration-id', 'c1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('c1')
		expect(result).toEqual({ message: 'Configuration deleted' })
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--configuration-id', 'c1'])
	testRejectsInvalidIdentifier(runCommand, 'configuration-id', 'resource', [
		'--project-code',
		'PRJ',
	])
})

test('deletes a configuration on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Configuration>(
		'api',
		'configurations',
		'create',
		'--project-code',
		project.code,
		'--title',
		'CLI deleted configuration'
	)
	const result = await runCommand<{ message: string }>(
		'--project-code',
		project.code,
		'--configuration-id',
		created.id
	)
	expect(result).toHaveProperty('message')
})
