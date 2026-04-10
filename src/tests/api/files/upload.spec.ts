import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { HttpResponse, http } from 'msw'
import { afterAll, beforeAll, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) => runCli<T>('api', 'files', 'upload', ...args)

describe('mocked', () => {
	let tempDir: string
	const mockResponse = { id: 'file1', url: 'https://example.com/file1.png' }

	useMockServer(
		http.post(`${baseURL}/api/public/v0/file/batch`, async ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			return HttpResponse.json({ files: [mockResponse] })
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

	test('rejects file exceeding max size', async () => {
		const filePath = join(tempDir, 'large-file.bin')
		// Create a file just over 50 MiB
		const size = 1024 * 1024 * 50 + 1
		writeFileSync(filePath, Buffer.alloc(size))

		await expectValidationError(
			() => runCommand('--file', filePath),
			/exceeds the maximum allowed size of 50 MiB/
		)
	})

	test('accepts file exactly at max size', async () => {
		const filePath = join(tempDir, 'exact-file.bin')
		writeFileSync(filePath, Buffer.alloc(1024 * 1024 * 50))

		const result = await runCommand('--file', filePath)
		expect(result).toEqual(mockResponse)
	})
})
