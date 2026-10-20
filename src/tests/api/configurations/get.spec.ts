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
	runCli<T>('api', 'configurations', 'get', ...args)

describe('mocked', () => {
	const mockConfiguration = { id: 'c1', title: 'Chrome', runCount: 2 }
	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/configuration/:id`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockConfiguration)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a configuration', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--configuration-id', 'c1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.id).toBe('c1')
		expect(result).toEqual(mockConfiguration)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--configuration-id', 'c1'])
	testRejectsInvalidIdentifier(runCommand, 'configuration-id', 'resource', [
		'--project-code',
		'PRJ',
	])
})

test('gets a configuration on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Configuration>(
		'api',
		'configurations',
		'create',
		'--project-code',
		project.code,
		'--title',
		'CLI fetched configuration'
	)
	const result = await runCommand<Configuration>(
		'--project-code',
		project.code,
		'--configuration-id',
		created.id
	)
	expect(result).toEqual(created)
})
