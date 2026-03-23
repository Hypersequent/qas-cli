import { HttpResponse, http } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import { test, baseURL, token, useMockServer, runCli, expectValidationError } from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'projects', 'create', ...args)

describe('mocked', () => {
	let lastRequest: unknown = null

	useMockServer(
		http.post(`${baseURL}/api/public/v0/project`, async ({ request }) => {
			expect(request.headers.get('Authorization')).toEqual(`ApiKey ${token}`)
			lastRequest = await request.json()
			return HttpResponse.json({ id: 'p1', code: 'PRJ', title: 'My Project' })
		})
	)

	beforeEach(() => {
		lastRequest = null
	})

	describe('successful requests', () => {
		test('creates a project with required fields', async () => {
			const result = await runCommand('--code', 'PRJ', '--title', 'My Project')
			expect(lastRequest).toEqual({ code: 'PRJ', title: 'My Project' })
			expect(result).toEqual({ id: 'p1', code: 'PRJ', title: 'My Project' })
		})

		test('creates a project with all optional fields', async () => {
			await runCommand(
				'--code',
				'PRJ',
				'--title',
				'My Project',
				'--links',
				'[{"text": "Docs", "url": "https://example.com"}]',
				'--overview-title',
				'Overview',
				'--overview-description',
				'Desc'
			)
			expect(lastRequest).toEqual({
				code: 'PRJ',
				title: 'My Project',
				links: [{ text: 'Docs', url: 'https://example.com' }],
				overviewTitle: 'Overview',
				overviewDescription: 'Desc',
			})
		})
	})
})

describe('validation errors', () => {
	test('rejects code shorter than 2 characters', async () => {
		await expectValidationError(
			() => runCommand('--code', 'X', '--title', 'Test'),
			/--code must be at least 2 characters/
		)
	})

	test('rejects code longer than 5 characters', async () => {
		await expectValidationError(
			() => runCommand('--code', 'ABCDEF', '--title', 'Test'),
			/--code must be at most 5 characters/
		)
	})

	test('rejects non-alphanumeric code', async () => {
		await expectValidationError(
			() => runCommand('--code', 'PR-J', '--title', 'Test'),
			/--code must contain only alphanumeric characters/
		)
	})

	test('rejects links with old "title" field name', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--code',
					'PRJ',
					'--title',
					'Test',
					'--links',
					'[{"title": "Docs", "url": "https://example.com"}]'
				),
			/Validation failed/
		)
	})

	test('rejects overview-title exceeding 255 characters', async () => {
		await expectValidationError(
			() => runCommand('--code', 'PRJ', '--title', 'Test', '--overview-title', 'x'.repeat(256)),
			/--overview-title must be at most 255 characters/
		)
	})
})
