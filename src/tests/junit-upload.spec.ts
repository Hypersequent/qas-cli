import { afterAll, beforeAll, expect, test, describe, afterEach } from 'vitest'
import { run } from '../commands/main'
import { setupServer } from 'msw/node'
import { HttpResponse, http } from 'msw'
import { runTestCases } from './fixtures/testcases'
import { countMockedApiCalls } from './utils'

const projectCode = 'TEST'
const runId = '1'
const domain = 'qas'
const zone = 'eu1'
const baseURL = `https://${domain}.${zone}.qasphere.com`
const xmlBasePath = './src/tests/fixtures/junit-xml'

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey API_TOKEN')
		return HttpResponse.json({
			tcases: runTestCases,
		})
	}),
	http.post(
		new RegExp(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase/.+/result`),
		({ request }) => {
			expect(request.headers.get('Authorization')).toEqual('ApiKey API_TOKEN')
			return HttpResponse.json({
				id: 0,
			})
		}
	),
	http.post(`${baseURL}/api/public/v0/file`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey API_TOKEN')
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
		test('Passed --url argument should use https when protocol is omitted', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload --url ${domain}.${zone}.qasphere.com -p ${projectCode} -r ${runId} -t API_TOKEN ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})
	})

	describe('Uploading test results', () => {
		test('Test cases on xml file with all matching test cases on QAS should be successful', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})

		test('Test cases on xml file with a missing test case on QAS should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(
					`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ${xmlBasePath}/missing-tcases.xml`
				)
			).rejects.toThrow()
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(0)
		})

		test('Test cases on xml file with a missing test case on QAS should be successful when forced', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --force ${xmlBasePath}/missing-tcases.xml`
			)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(4)
		})
	})

	describe('Uploading with attachments', () => {
		test('Attachments should be uploaded', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments ${xmlBasePath}/matching-tcases.xml`
			)
			expect(fileUploadCount()).toBe(5)
			expect(tcaseUploadCount()).toBe(5)
		})
		test('Missing attachments should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(
					`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments ${xmlBasePath}/missing-attachments.xml`
				)
			).rejects.toThrow()
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(0)
		})
		test('Missing attachments should be successful when forced', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments --force ${xmlBasePath}/missing-attachments.xml`
			)
			expect(fileUploadCount()).toBe(4)
			expect(tcaseUploadCount()).toBe(5)
		})
	})
})
