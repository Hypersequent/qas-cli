import { afterAll, beforeAll, expect, test, describe, afterEach } from 'vitest'
import { run } from '../commands/main'
import { setupServer } from 'msw/node'
import { HttpResponse, http } from 'msw'
import { runTestCases } from './fixtures/testcases'
import { countMockedApiCalls } from './utils'

const projectCode = 'TEST'
const runId = '1'
const qasHost = 'qas.eu1.qasphere.com'
const baseURL = `https://${qasHost}`
const runURL = `${baseURL}/project/${projectCode}/run/${runId}`

process.env['QAS_TOKEN'] = 'QAS_TOKEN'
process.env['QAS_URL'] = baseURL

let lastCreatedRunTitle = ''
let createRunTitleConflict = false

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project/${projectCode}`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json({ exists: true })
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/tcase/seq`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json({
			data: runTestCases,
			total: runTestCases.length,
		})
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/run`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		const body = (await request.json()) as { title: string }
		lastCreatedRunTitle = body.title

		if (createRunTitleConflict) {
			return HttpResponse.json(
				{
					message: 'run title must be unique within the milestone, conflicting run id: 1',
				},
				{
					status: 403,
				}
			)
		}

		return HttpResponse.json({
			id: parseInt(runId),
		})
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json({
			tcases: runTestCases,
		})
	}),
	http.post(
		new RegExp(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase/.+/result`),
		({ request }) => {
			expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
			return HttpResponse.json({
				id: 0,
			})
		}
	),
	http.post(`${baseURL}/api/public/v0/file`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		expect(request.headers.get('Content-Type')).includes('multipart/form-data')
		return HttpResponse.json({
			id: 'TEST',
			url: 'http://example.com',
		})
	})
)

beforeAll(() => {
	server.listen({ onUnhandledRequest: 'error' })
})
afterAll(() => {
	server.close()
})
afterEach(() => {
	server.resetHandlers()
	server.events.removeAllListeners()
})

const countFileUploadApiCalls = () =>
	countMockedApiCalls(server, (req) => req.url.endsWith('/file'))
const countResultUploadApiCalls = () =>
	countMockedApiCalls(server, (req) => new URL(req.url).pathname.endsWith('/result'))

const fileTypes = [
	{
		name: 'JUnit XML',
		command: 'junit-upload',
		dataBasePath: './src/tests/fixtures/junit-xml',
		fileExtension: 'xml',
	},
	{
		name: 'Playwright JSON',
		command: 'playwright-json-upload',
		dataBasePath: './src/tests/fixtures/playwright-json',
		fileExtension: 'json',
	},
]

fileTypes.forEach((fileType) => {
	describe(`Uploading ${fileType.name} files`, () => {
		describe('Argument parsing', () => {
			test('Passing correct Run URL pattern should result in success', async () => {
				const patterns = [
					`${fileType.command} --run-url ${runURL} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
					`${fileType.command} -r ${runURL}/ ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
					`${fileType.command} -r ${runURL}/tcase/1 ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
				]

				for (const pattern of patterns) {
					const fileUploadCount = countFileUploadApiCalls()
					const tcaseUploadCount = countResultUploadApiCalls()
					await run(pattern)
					expect(fileUploadCount()).toBe(0)
					expect(tcaseUploadCount()).toBe(5)
				}
			})

			test('Passing correct Run URL pattern without https, should result in success', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${qasHost}/project/${projectCode}/run/${runId} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(5)
			})

			test('Passing incorrect Run URL pattern should result in failure', async () => {
				const patterns = [
					`${fileType.command} -r ${qasHost}/projects/${projectCode}/runs/${runId} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
					`${fileType.command} -r ${runURL}abc/tcase/1 ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
				]

				for (const pattern of patterns) {
					const fileUploadCount = countFileUploadApiCalls()
					const tcaseUploadCount = countResultUploadApiCalls()
					let isError = false

					try {
						await run(pattern)
					} catch {
						isError = true
					}
					expect(isError).toBeTruthy()
					expect(fileUploadCount()).toBe(0)
					expect(tcaseUploadCount()).toBe(0)
				}
			})
		})

		describe('Uploading test results', () => {
			test('Test cases on reports with all matching test cases on QAS should be successful', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(5)
			})

			test('Test cases on reports with a missing test case on QAS should throw an error', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await expect(
					run(
						`${fileType.command} -r ${runURL} ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
					)
				).rejects.toThrowError()
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(0)
			})

			test('Test cases on reports with a missing test case on QAS should be successful when forced', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(4)
			})

			test('Test cases on reports with missing test cases should be successful with --ignore-unmatched', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --ignore-unmatched ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(4)
			})

			test('Test cases from multiple reports should be processed successfully', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension} ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(8)
			})

			test('Test suite with empty tcases should not result in error and be skipped', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/empty-tsuite.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(1)
			})
		})

		describe('Uploading with attachments', () => {
			test('Attachments should be uploaded', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --attachments ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(5)
				expect(tcaseUploadCount()).toBe(5)
			})
			test('Missing attachments should throw an error', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await expect(
					run(
						`${fileType.command} -r ${runURL} --attachments ${fileType.dataBasePath}/missing-attachments.${fileType.fileExtension}`
					)
				).rejects.toThrow()
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(0)
			})
			test('Missing attachments should be successful when forced', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --attachments --force ${fileType.dataBasePath}/missing-attachments.${fileType.fileExtension}`
				)
				expect(fileUploadCount()).toBe(4)
				expect(tcaseUploadCount()).toBe(5)
			})
		})

		describe('Run name template processing', () => {
			afterEach(() => {
				lastCreatedRunTitle = ''
				createRunTitleConflict = false
			})

			test('Should create new run with name template using environment variables', async () => {
				// Set up test environment variable
				const oldEnv = process.env.TEST_BUILD_NUMBER
				process.env.TEST_BUILD_NUMBER = '456'

				try {
					// This should create a new run since no --run-url is specified
					await run(
						`${fileType.command} --run-name "CI Build {env:TEST_BUILD_NUMBER}" ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
					)

					expect(lastCreatedRunTitle).toBe('CI Build 456')
				} finally {
					// Restore original environment
					if (oldEnv !== undefined) {
						process.env.TEST_BUILD_NUMBER = oldEnv
					} else {
						delete process.env.TEST_BUILD_NUMBER
					}
				}
			})

			test('Should create new run with name template using date placeholders', async () => {
				const now = new Date()
				const expectedYear = now.getFullYear().toString()
				const expectedMonth = String(now.getMonth() + 1).padStart(2, '0')
				const expectedDay = String(now.getDate()).padStart(2, '0')

				await run(
					`${fileType.command} --run-name "Test Run {YYYY}-{MM}-{DD}" ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)

				expect(lastCreatedRunTitle).toBe(`Test Run ${expectedYear}-${expectedMonth}-${expectedDay}`)
			})

			test('Should create new run with name template using mixed placeholders', async () => {
				const oldEnv = process.env.TEST_PROJECT
				process.env.TEST_PROJECT = 'MyProject'

				try {
					await run(
						`${fileType.command} --run-name "{env:TEST_PROJECT} - {YYYY}/{MM}" ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
					)

					const now = new Date()
					const expectedYear = now.getFullYear().toString()
					const expectedMonth = String(now.getMonth() + 1).padStart(2, '0')

					expect(lastCreatedRunTitle).toBe(`MyProject - ${expectedYear}/${expectedMonth}`)
				} finally {
					if (oldEnv !== undefined) {
						process.env.TEST_PROJECT = oldEnv
					} else {
						delete process.env.TEST_PROJECT
					}
				}
			})

			test('Should reuse existing run when run title is already used', async () => {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()

				createRunTitleConflict = true
				await run(
					`${fileType.command} --run-name "duplicate run title" ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)

				expect(lastCreatedRunTitle).toBe('duplicate run title')
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(5)
			})

			test('Should use default name template when --run-name is not specified', async () => {
				await run(
					`${fileType.command} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)

				// Should use default format: "Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}"
				expect(lastCreatedRunTitle).toContain('Automated test run - ')
				expect(lastCreatedRunTitle).toMatch(
					/Automated test run - \w{3} \d{2}, \d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)/
				)
			})
		})
	})
})
