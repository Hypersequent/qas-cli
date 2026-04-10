import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { SharedPrecondition } from '../../../api/shared-preconditions'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'shared-preconditions', 'list', ...args)

describe('mocked', () => {
	const mockData = [{ id: 1, title: 'User is logged in' }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/shared-precondition`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				return HttpResponse.json(mockData)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists shared preconditions', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockData)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

describe('live', { tags: ['live'] }, () => {
	test('lists shared preconditions', async ({ project }) => {
		const result = await runCli<SharedPrecondition[] | null>(
			'api',
			'shared-preconditions',
			'list',
			'--project-code',
			project.code
		)
		// Fresh project has no shared preconditions; API returns null for empty list
		// Currently there's no way to create shared preconditions via the public API
		expect(result === null || Array.isArray(result)).toBe(true)
	})
})
