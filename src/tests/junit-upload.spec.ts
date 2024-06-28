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
const xmlBasePath = './src/tests/fixtures/junit-xml'

process.env['QAS_TOKEN'] = 'QAS_TOKEN'

const server = setupServer(
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

describe('Uploading JUnit xml files', () => {
	describe('Argument parsing', () => {
		test('Passing correct Run URL pattern should result in success', async () => {
			const patterns = [
				`junit-upload --run-url ${runURL} ${xmlBasePath}/matching-tcases.xml`,
				`junit-upload -r ${runURL}/ ${xmlBasePath}/matching-tcases.xml`,
				`junit-upload -r ${runURL}/tcase/1 ${xmlBasePath}/matching-tcases.xml`,
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
				`junit-upload -r ${qasHost}/project/${projectCode}/run/${runId} ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})

		test('Passing incorrect Run URL pattern should result in failure', async () => {
			const patterns = [
				`junit-upload -r ${qasHost}/projects/${projectCode}/runs/${runId} ${xmlBasePath}/matching-tcases.xml`,
				`junit-upload -r ${runURL}abc/tcase/1 ${xmlBasePath}/matching-tcases.xml`,
			]

			for (const pattern of patterns) {
				const fileUploadCount = countFileUploadApiCalls()
				const tcaseUploadCount = countResultUploadApiCalls()
				let isError = false

				try {
					await run(pattern)
				} catch (error) {
					isError = true
				}
				expect(isError).toBeTruthy()
				expect(fileUploadCount()).toBe(0)
				expect(tcaseUploadCount()).toBe(0)
			}
		})
	})

	describe('Uploading test results', () => {
		test('Test cases on xml file with all matching test cases on QAS should be successful', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload -r ${runURL} ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})

		test('Test cases on xml file with a missing test case on QAS should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(
					`junit-upload -r ${runURL} ${xmlBasePath}/missing-tcases.xml`
				)
			).rejects.toThrowError()
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(0)
		})

		test('Test cases on xml file with a missing test case on QAS should be successful when forced', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload -r ${runURL} --force ${xmlBasePath}/missing-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(4)
		})

		test('Test cases from muliple xml files should be processed successfully', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload -r ${runURL} --force ${xmlBasePath}/missing-tcases.xml ${xmlBasePath}/missing-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(8)
		})

		test('Test suite with empty tcases should not result in error and be skipped', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload -r ${runURL} --force ${xmlBasePath}/empty-tsuite.xml`
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
				`junit-upload -r ${runURL} --attachments ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(5)
			expect(tcaseUploadCount()).toBe(5)
		})
		test('Missing attachments should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(
					`junit-upload -r ${runURL} --attachments ${xmlBasePath}/missing-attachments.xml`
				)
			).rejects.toThrow()
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(0)
		})
		test('Missing attachments should be successful when forced', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload -r ${runURL} --attachments --force ${xmlBasePath}/missing-attachments.xml`
			)
			expect(fileUploadCount()).toBe(4)
			expect(tcaseUploadCount()).toBe(5)
		})
	})
})
