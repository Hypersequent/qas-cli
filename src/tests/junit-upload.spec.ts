import { afterAll, beforeAll, expect, test, describe } from 'vitest'
import { setupServer } from 'msw/node'
import { HttpResponse, http } from 'msw'
import { run } from './utils'
import { afterEach } from 'node:test'
import { runTestCases } from './fixtures/testcases'

const projectCode = 'P1'
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
})

describe('Uploading JUnit xml files', () => {
	describe('Uploading test results', () => {
		test('Test cases on xml file with all matching test cases on QAS should be successful', async () => {
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ${xmlBasePath}/matching-tcases.xml`
			)
		})

		test('Test cases on xml file with a missing test case on QAS should not throw an error', async () => {
			await expect(
				run(
					`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ${xmlBasePath}/missing-tcases.xml`
				)
			).rejects.toThrow()
		})

		test('Test cases on xml file with a missing test case on QAS should be successful when forced', async () => {
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --force ${xmlBasePath}/matching-tcases.xml`
			)
		})
	})

	describe('Uploading with attachments', () => {
		test('Attachments should be uploaded', async () => {
			let uploadCallCount = 0
			server.events.on('response:mocked', (e) => {
				if (e.request.url.endsWith('/file')) {
					uploadCallCount++
				}
			})
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments ${xmlBasePath}/matching-tcases.xml`
			)
			expect(uploadCallCount).toBe(5)
		})
		test('Missing attachments should throw an error', async () => {
			await expect(
				run(
					`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments ${xmlBasePath}/missing-attachments.xml`
				)
			).rejects.toThrow()
		})
		test('Missing attachments should be successful when forced', async () => {
			let uploadCallCount = 0
			server.events.on('response:mocked', (e) => {
				if (e.request.url.endsWith('/file')) {
					uploadCallCount++
				}
			})
			await run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --attachments --force ${xmlBasePath}/missing-attachments.xml`
			)
			expect(uploadCallCount).toBe(4)
		})
	})
})
