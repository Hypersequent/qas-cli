import { HttpResponse, http } from 'msw'
import { describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'projects', 'get', ...args)

describe('mocked', () => {
	const mockProject = { id: 'p1', code: 'PRJ', title: 'Project 1' }

	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:codeOrId`, ({ params, request }) => {
			expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
			expect(params['codeOrId']).toEqual('PRJ')
			lastSearchParams = new URL(request.url).searchParams
			return HttpResponse.json(mockProject)
		})
	)

	test('gets a project by code', async () => {
		const result = await runCommand('--project-code', 'PRJ')
		expect(lastSearchParams?.toString()).toBe('')
		expect(result).toEqual(mockProject)
	})

	test('passes include as a query parameter', async () => {
		await runCommand('--project-code', 'PRJ', '--include', 'stats')
		expect(lastSearchParams?.getAll('include')).toEqual(['stats'])
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')
})

test('gets a project on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand('--project-code', project.code)
	expect(result).toHaveProperty('code', project.code)
	expect(result).toHaveProperty('id')
	expect(result).toHaveProperty('title')
})
