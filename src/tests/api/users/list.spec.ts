import { HttpResponse, http } from 'msw'
import { describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'users', 'list', ...args)

describe('mocked', () => {
	const mockUsers = [{ id: 1, email: 'user@example.com', name: 'User', role: 'admin' }]

	useMockServer(
		http.get(`${baseURL}/api/public/v0/users`, ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			return HttpResponse.json({ users: mockUsers })
		})
	)

	test('lists all users', async () => {
		const result = await runCommand()
		expect(result).toEqual(mockUsers)
	})
})
