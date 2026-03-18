import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'custom-fields', 'list', ...args)

describe('mocked', () => {
	const mockFields = [{ id: 1, title: 'Browser', type: 'dropdown', isActive: true }]

	let lastParams: PathParams = {}

	useMockServer(
		http.get(
			`${baseURL}/api/public/v0/project/:projectCode/custom-field`,
			({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
				lastParams = params
				return HttpResponse.json({ customFields: mockFields })
			}
		)
	)

	afterEach(() => {
		lastParams = {}
	})

	test('lists custom fields in a project', async ({ project }) => {
		const result = await runCommand('--project-code', project.code)
		expect(lastParams.projectCode).toBe(project.code)
		expect(result).toEqual(mockFields)
	})
})
