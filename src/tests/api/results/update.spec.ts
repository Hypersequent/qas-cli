import { HttpResponse, http, type PathParams } from 'msw'
import { afterEach, describe, expect } from 'vitest'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	testRejectsInvalidIdentifier,
	createFolder,
	createTCase,
	createRun,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'results', 'update', ...args)

describe('mocked', () => {
	const mockResponse = { id: 10, tcaseId: 'tc1', status: 'failed', comment: 'Retried', links: [] }
	let lastParams: PathParams = {}
	let lastRequest: unknown = null

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/run/:runId/result/:resultId`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(mockResponse)
			}
		)
	)

	afterEach(() => {
		lastParams = {}
		lastRequest = null
	})

	test("updates a result's comment and links", async ({ project }) => {
		const result = await runCommand(
			'--project-code',
			project.code,
			'--run-id',
			'42',
			'--result-id',
			'10',
			'--comment',
			'Retried',
			'--create-links',
			'[{"integrationId": "i1", "url": "https://acme.atlassian.net/browse/QA-1", "text": "Login fails", "meta": {"id": "10001"}}]',
			'--delete-link-ids',
			'3,4'
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastParams.resultId).toBe('10')
		expect(lastRequest).toEqual({
			comment: 'Retried',
			createLinks: [
				{
					integrationId: 'i1',
					url: 'https://acme.atlassian.net/browse/QA-1',
					text: 'Login fails',
					meta: { id: '10001' },
				},
			],
			deleteLinkIds: [3, 4],
		})
		expect(result).toEqual(mockResponse)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { comment: 'Retried' }
			const requiredArgs = ['--project-code', 'PRJ', '--run-id', '1', '--result-id', '10']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--time-taken', '1500'],
				expectedRequest: { comment: 'Retried', timeTaken: 1500 },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ createLinks: [{ integrationId: 'i1', url: 'ftp://a.com', text: 'Bug' }] },
				/must be an http or https URL/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--run-id',
		'1',
		'--result-id',
		'10',
		'--comment',
		'X',
	])

	test('requires a field to update', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--run-id', '1', '--result-id', '10'),
			/At least one field to update is required/
		)
	})

	test('rejects a link without an integration', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--run-id',
					'1',
					'--result-id',
					'10',
					'--create-links',
					'[{"url": "https://a.com/1", "text": "Bug"}]'
				),
			/--create-links.*integrationId/
		)
	})
})

test("updates a result's comment on live server", { tags: ['live'] }, async ({ project }) => {
	const folder = await createFolder(project.code)
	const tcase = await createTCase(project.code, folder.ids[0][0])
	const run = await createRun(project.code, [tcase.id])
	const created = await runCli<{ id: number }>(
		'api',
		'results',
		'create',
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--tcase-id',
		tcase.id,
		'--status',
		'failed'
	)
	const result = await runCommand<{ comment: string }>(
		'--project-code',
		project.code,
		'--run-id',
		String(run.id),
		'--result-id',
		String(created.id),
		'--comment',
		'CLI retried'
	)
	expect(result.comment).toContain('CLI retried')
})
