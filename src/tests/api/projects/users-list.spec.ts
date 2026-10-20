import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { ProjectUser } from '../../../api/projects'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'projects', 'users', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		users: [{ id: 1, email: 'jane@example.com', name: 'Jane', avatar: null, role: 'owner' }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/users`, ({ request, params }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			lastParams = params
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockResponse)
		})
	)

	afterEach(() => {
		lastParams = {}
		lastSearchParams = null
	})

	test('lists the users of a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes the role filter', async ({ project }) => {
		await runCommand('--project-code', project.code, '--roles', 'user, test-runner')
		expect(lastSearchParams!.getAll('roles')).toEqual(['user', 'test-runner'])
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects an unknown role', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--roles', 'user,guest'),
			/--roles.*must be comma-separated values of/
		)
	})
})

test('lists project users on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<{ users: ProjectUser[] }>('--project-code', project.code)
	expect(result.users.length).toBeGreaterThan(0)
})
