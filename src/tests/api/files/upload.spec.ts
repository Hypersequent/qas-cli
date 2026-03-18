import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http } from 'msw'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'files', 'upload', ...args)

describe('mocked', () => {
	let tempDir: string
	const mockResponse = { id: 'file1', url: 'https://example.com/file1.png' }

	useMockServer(
		http.post(`${baseURL}/api/public/v0/file`, async ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			return HttpResponse.json(mockResponse)
		})
	)

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'qas-files-test-'))
	})
	afterAll(() => {
		rmSync(tempDir, { recursive: true })
	})

	test('uploads a file', async () => {
		const filePath = join(tempDir, 'screenshot.png')
		writeFileSync(filePath, 'fake png content')

		const result = await runCommand('--file', filePath)
		expect(result).toEqual(mockResponse)
	})
})
