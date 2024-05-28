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

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey API_TOKEN')
		expect(new URL(request.url).searchParams.get('folder')).toBeDefined()
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
	http.post(`${baseURL}/api/public/v0/file`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey API_TOKEN')
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
	test('Test cases on xml file with all matching test cases on QAS should be successful', async () => {
		await run(
			`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ./src/tests/fixtures/junit.xml`
		)
	})
	test('Test cases on xml file with a missing test case on QAS should not be successful', async () => {
		await expect(
			run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN ./src/tests/fixtures/junit2.xml`
			)
		).rejects.toThrow()
	})
	test('Test cases on xml file with a missing test case on QAS should be successful when forced', async () => {
		await expect(
			run(
				`junit-upload --url ${baseURL} -p ${projectCode} -r ${runId} -t API_TOKEN --force ./src/tests/fixtures/junit2.xml`
			)
		).resolves.not.toThrow()
	})
})
