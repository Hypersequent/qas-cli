import { afterAll, beforeAll, expect, test, describe, afterEach } from 'vitest'
import { run } from '../commands/main'
import { setupServer } from 'msw/node'
import { HttpResponse, http } from 'msw'
import { runTestCases } from './fixtures/testcases'
import { countMockedApiCalls } from './utils'
import { processTemplate, monthNames } from '../utils/misc'

const projectCode = 'TEST'
const runId = '1'
const qasHost = 'qas.eu1.qasphere.com'
const baseURL = `https://${qasHost}`
const runURL = `${baseURL}/project/${projectCode}/run/${runId}`
const xmlBasePath = './src/tests/fixtures/junit-xml'

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

describe('Template string processing', () => {
	test('Should leave unknown environment variables unchanged', () => {
		const result = processTemplate('Build {env:UNKNOWN_VAR} completed')
		expect(result).toBe('Build {env:UNKNOWN_VAR} completed')
	})

	test('Should handle templates with no placeholders', () => {
		const template = 'Simple test run name'
		const result = processTemplate(template)
		expect(result).toBe('Simple test run name')
	})

	test('Should process all placeholder types correctly', () => {
		const oldEnv = process.env.TEST_BUILD
		process.env.TEST_BUILD = '456'

		try {
			const now = new Date()
			const template = '{env:TEST_BUILD} - {YYYY}/{YY}/{MMM}/{MM}/{DD} {HH}:{hh}:{mm}:{ss} {AMPM}'
			const result = processTemplate(template, now)

			const yearStr = String(now.getFullYear())
			const month = now.getMonth()
			const monthStr = String(month + 1).padStart(2, '0')
			const dayStr = String(now.getDate()).padStart(2, '0')
			const hour24 = now.getHours()
			const hour24Str = String(hour24).padStart(2, '0')
			const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
			const hour12Str = String(hour12).padStart(2, '0')
			const minStr = String(now.getMinutes()).padStart(2, '0')
			const secStr = String(now.getSeconds()).padStart(2, '0')
			const ampm = hour24 < 12 ? 'AM' : 'PM'

			const expectedResult = `456 - ${yearStr}/${yearStr.slice(-2)}/${
				monthNames[month]
			}/${monthStr}/${dayStr} ${hour24Str}:${hour12Str}:${minStr}:${secStr} ${ampm}`

			expect(result).toBe(expectedResult)
		} finally {
			// Restore original environment
			if (oldEnv !== undefined) {
				process.env.TEST_BUILD = oldEnv
			} else {
				delete process.env.TEST_BUILD
			}
		}
	})
})

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
		test('Test cases on xml file with all matching test cases on QAS should be successful', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(`junit-upload -r ${runURL} ${xmlBasePath}/matching-tcases.xml`)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})

		test('Test cases on xml file with a missing test case on QAS should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(`junit-upload -r ${runURL} ${xmlBasePath}/missing-tcases.xml`)
			).rejects.toThrowError()
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(0)
		})

		test('Test cases on xml file with a missing test case on QAS should be successful when forced', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(`junit-upload -r ${runURL} --force ${xmlBasePath}/missing-tcases.xml`)
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
			await run(`junit-upload -r ${runURL} --force ${xmlBasePath}/empty-tsuite.xml`)
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(1)
		})
	})

	describe('Uploading with attachments', () => {
		test('Attachments should be uploaded', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await run(`junit-upload -r ${runURL} --attachments ${xmlBasePath}/matching-tcases.xml`)
			expect(fileUploadCount()).toBe(5)
			expect(tcaseUploadCount()).toBe(5)
		})
		test('Missing attachments should throw an error', async () => {
			const fileUploadCount = countFileUploadApiCalls()
			const tcaseUploadCount = countResultUploadApiCalls()
			await expect(
				run(`junit-upload -r ${runURL} --attachments ${xmlBasePath}/missing-attachments.xml`)
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
					`junit-upload --run-name "CI Build {env:TEST_BUILD_NUMBER}" ${xmlBasePath}/matching-tcases.xml`
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
				`junit-upload --run-name "Test Run {YYYY}-{MM}-{DD}" ${xmlBasePath}/matching-tcases.xml`
			)

			expect(lastCreatedRunTitle).toBe(`Test Run ${expectedYear}-${expectedMonth}-${expectedDay}`)
		})

		test('Should create new run with name template using mixed placeholders', async () => {
			const oldEnv = process.env.TEST_PROJECT
			process.env.TEST_PROJECT = 'MyProject'

			try {
				await run(
					`junit-upload --run-name "{env:TEST_PROJECT} - {YYYY}/{MM}" ${xmlBasePath}/matching-tcases.xml`
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
			await run(`junit-upload --run-name "duplicate run title" ${xmlBasePath}/matching-tcases.xml`)

			expect(lastCreatedRunTitle).toBe('duplicate run title')
			expect(fileUploadCount()).toBe(0)
			expect(tcaseUploadCount()).toBe(5)
		})

		test('Should use default name template when --run-name is not specified', async () => {
			await run(`junit-upload ${xmlBasePath}/matching-tcases.xml`)

			// Should use default format: "Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}"
			expect(lastCreatedRunTitle).toContain('Automated test run - ')
			expect(lastCreatedRunTitle).toMatch(
				/Automated test run - \w{3} \d{2}, \d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)/
			)
		})
	})
})
