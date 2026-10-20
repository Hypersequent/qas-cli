import { HttpResponse, http, type PathParams } from 'msw'
import { beforeEach, describe, expect } from 'vitest'
import type { TCase, TCasesResponse } from '../../../api/tcases'
import {
	test,
	baseURL,
	token,
	useMockServer,
	runCli,
	createFolder,
	createTCase,
	testRejectsInvalidIdentifier,
	testBodyInput,
	expectValidationError,
} from '../test-helper'

const runCommand = <T = unknown>(...args: string[]) =>
	runCli<T>('api', 'test-cases', 'update-requirements', ...args)

describe('mocked', () => {
	const response = { tcases: [{ id: 'tc1', seq: 12 }] }
	let lastRequest: unknown = null
	let lastParams: PathParams = {}

	useMockServer(
		http.patch(
			`${baseURL}/api/public/v0/project/:projectCode/tcase/requirements`,
			async ({ request, params }) => {
				expect(request.headers.get('Authorization')).toEqual(`Bearer ${token}`)
				lastParams = params
				lastRequest = await request.json()
				return HttpResponse.json(response)
			}
		)
	)

	beforeEach(() => {
		lastRequest = null
		lastParams = {}
	})

	test('links and unlinks requirements', async ({ project }) => {
		const add = [{ text: 'REQ-1', url: 'https://example.com/req/1' }]
		const remove = [{ text: 'REQ-0' }]
		const result = await runCommand(
			'--project-code',
			project.code,
			'--tcase-ids',
			'12,13',
			'--add',
			JSON.stringify(add),
			'--remove',
			JSON.stringify(remove)
		)
		expect(lastParams.projectCode).toBe(project.code)
		expect(lastRequest).toEqual({ tcaseIds: ['12', '13'], add, remove })
		expect(result).toEqual(response)
	})

	testBodyInput(
		runCommand,
		() => lastRequest,
		(h) => {
			const validBody = { tcaseIds: ['12'], add: [{ text: 'REQ-1' }] }
			const requiredArgs = ['--project-code', 'PRJ']
			h.testInlineBody(validBody, validBody, requiredArgs)
			h.testBodyFile(validBody, validBody, requiredArgs)
			h.testFieldOverride({
				body: validBody,
				flags: ['--tcase-ids', '13'],
				expectedRequest: { tcaseIds: ['13'], add: [{ text: 'REQ-1' }] },
				requiredArgs,
			})
			h.testInvalidJson(requiredArgs)
			h.testInvalidBody(
				{ tcaseIds: ['12'], add: [{ text: '' }] },
				/text must not be empty/,
				requiredArgs
			)
		}
	)
})

describe('validation errors', () => {
	testRejectsInvalidIdentifier(runCommand, 'project-code', 'code', [
		'--tcase-ids',
		'12',
		'--add',
		JSON.stringify([{ text: 'REQ-1' }]),
	])

	test('rejects a requirement without text', async () => {
		await expectValidationError(
			() =>
				runCommand(
					'--project-code',
					'PRJ',
					'--tcase-ids',
					'12',
					'--add',
					JSON.stringify([{ url: 'https://example.com' }])
				),
			/--add\.0\.text/
		)
	})

	test('requires requirements to link or unlink', async () => {
		await expectValidationError(
			() => runCommand('--project-code', 'PRJ', '--tcase-ids', '12'),
			/Either --add or --remove is required/
		)
	})
})

test(
	'links a requirement to test cases on live server',
	{ tags: ['live'] },
	async ({ project }) => {
		const folder = await createFolder(project.code)
		const created = await createTCase(project.code, folder.ids[0][0])
		const result = await runCommand<TCasesResponse>(
			'--project-code',
			project.code,
			'--tcase-ids',
			created.id,
			'--add',
			JSON.stringify([{ text: 'CLI-REQ-1' }])
		)
		expect(result.tcases.map((t) => t.id)).toEqual([created.id])
		const updated = await runCli<TCase>(
			'api',
			'test-cases',
			'get',
			'--project-code',
			project.code,
			'--tcase-id',
			created.id
		)
		expect(updated.requirements?.map((r) => r.text)).toContain('CLI-REQ-1')
	}
)
