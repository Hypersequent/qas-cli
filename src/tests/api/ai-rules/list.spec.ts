import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import type { AIRule } from '../../../api/ai-rules'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	expectValidationError,
	testRejectsInvalidIdentifier,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'ai-rules', 'list', ...args)

describe('mocked', () => {
	const mockResponse = {
		aiRules: [{ id: 'r1', name: 'Step wording', scope: 'project', type: 'tcase', enabled: true }],
	}
	let lastParams: PathParams = {}
	let lastSearchParams: URLSearchParams | null = null

	useMockServer(
		http.get(`${baseURL}/api/public/v0/project/:projectCode/ai-rule`, ({ request, params }) => {
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

	test('lists AI rules', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockResponse)
	})

	test('passes type and enabled params', async ({ project }) => {
		await runCommand('--project-code', project.code, '--types', 'system,all,tcase', '--enabled')
		expect(lastSearchParams!.getAll('types')).toEqual(['system', 'all', 'tcase'])
		expect(lastSearchParams!.get('enabled')).toBe('true')
	})

	test('lists disabled rules', async ({ project }) => {
		await runCommand('--project-code', project.code, '--enabled', 'false')
		expect(lastSearchParams!.get('enabled')).toBe('false')
	})
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code')

	test('rejects an unknown rule type', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--types', 'tcase,bogus'),
			/--types.*must be comma-separated values of/
		)
	})
})

test('lists AI rules on live server', { tags: ['live'] }, async ({ project }) => {
	const result = await runCommand<{ aiRules: AIRule[] }>(
		'--project-code',
		project.code,
		'--types',
		'system'
	)
	// A new project comes with its system rules
	expect(result.aiRules.length).toBeGreaterThan(0)
	expect(result.aiRules.every((rule) => rule.type === 'system')).toBe(true)
})
