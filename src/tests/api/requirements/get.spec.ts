import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import { randomBytes } from 'node:crypto'
import type { Requirement } from '../../../api/requirements'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'requirements', 'get', ...args)

describe('mocked', () => {
	const mockRequirement = {
		id: 'req1',
		text: 'Login',
		url: 'https://example.com/spec/login',
		tcaseCount: 2,
	}

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/requirement/:requirementId`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				return HttpResponse.json(mockRequirement)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('gets a requirement', async ({ project }) => {
		const result = await runCommand('--project-code', project.code, '--requirement-id', 'req1')
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.requirementId).toBe('req1')
		expect(result).toEqual(mockRequirement)
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', ['--requirement-id', 'req1'])
	testRejectsInvalidIdentifier(runCommand, 'requirement-id', 'resource', ['--project-code', 'PRJ'])
})

test('gets a requirement on live server', { tags: ['live'] }, async ({ project }) => {
	const created = await runCli<Requirement>(
		'api',
		'requirements',
		'create',
		'--project-code',
		project.code,
		'--text',
		`CLI requirement ${randomBytes(4).toString('hex')}`
	)
	const fetched = await runCommand<Requirement>(
		'--project-code',
		project.code,
		'--requirement-id',
		created.id
	)
	expect(fetched.id).toBe(created.id)
	expect(fetched.tcaseCount).toBe(0)
})
