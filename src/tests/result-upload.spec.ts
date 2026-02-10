import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { unlinkSync, readdirSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, test, describe, afterEach } from 'vitest'
import { run } from '../commands/main'
import {
	CreateTCasesRequest,
	CreateTCasesResponse,
	Folder,
	PaginatedResponse,
	TCase,
} from '../api/schemas'
import { DEFAULT_FOLDER_TITLE } from '../utils/result-upload/ResultUploadCommandHandler'
import { setMaxResultsInRequest } from '../utils/result-upload/ResultUploader'
import { runTestCases } from './fixtures/testcases'
import { countMockedApiCalls } from './utils'

const projectCode = 'TEST'
const runId = '1'
const qasHost = 'qas.eu1.qasphere.com'
const baseURL = `https://${qasHost}`
const runURL = `${baseURL}/project/${projectCode}/run/${runId}`

process.env['QAS_TOKEN'] = 'QAS_TOKEN'
process.env['QAS_URL'] = baseURL

let lastCreatedRunTitle = '' // Stores title in the request, for the last create run API call
let createRunTitleConflict = false // If true, the create run API returns a title conflict error
let createTCasesResponse: CreateTCasesResponse | null = null // Stores mock response for the create tcases API call
let overriddenGetPaginatedTCasesResponse: PaginatedResponse<TCase> | null = null // Stores overridden (non-default) response for the get tcases API call
let overriddenGetFoldersResponse: PaginatedResponse<Folder> | null = null // Stores overridden (non-default) response for the get folders API call

const server = setupServer(
	http.get(`${baseURL}/api/public/v0/project/${projectCode}`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json({ exists: true })
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/tcase/folders`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json(
			overriddenGetFoldersResponse || { data: [], total: 0, page: 1, limit: 50 }
		)
	}),
	http.get(`${baseURL}/api/public/v0/project/${projectCode}/tcase`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json(
			overriddenGetPaginatedTCasesResponse || { data: [], total: 0, page: 1, limit: 50 }
		)
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/tcase/seq`, ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
		return HttpResponse.json({
			data: runTestCases,
			total: runTestCases.length,
		})
	}),
	http.post(`${baseURL}/api/public/v0/project/${projectCode}/tcase/bulk`, async ({ request }) => {
		expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')

		if (!createTCasesResponse) {
			return HttpResponse.json(
				{
					message: 'No mock response set for create tcases API call',
				},
				{
					status: 500,
				}
			)
		}

		const body = (await request.json()) as CreateTCasesRequest
		if (body.tcases.length !== createTCasesResponse.tcases.length) {
			return HttpResponse.json(
				{
					message: `${body.tcases.length} test cases in request does not match ${createTCasesResponse.tcases.length} in the mock response`,
				},
				{
					status: 400,
				}
			)
		}
		return HttpResponse.json(createTCasesResponse)
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
		new RegExp(`${baseURL}/api/public/v0/project/${projectCode}/run/${runId}/result/batch`),
		({ request }) => {
			expect(request.headers.get('Authorization')).toEqual('ApiKey QAS_TOKEN')
			return HttpResponse.json({
				ids: [0],
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
	setMaxResultsInRequest(50)
})

const countFileUploadApiCalls = () =>
	countMockedApiCalls(server, (req) => req.url.endsWith('/file'))
const countResultUploadApiCalls = () =>
	countMockedApiCalls(server, (req) => new URL(req.url).pathname.endsWith('/result/batch'))
const countCreateTCasesApiCalls = () =>
	countMockedApiCalls(server, (req) => new URL(req.url).pathname.endsWith('/tcase/bulk'))

const getMappingFiles = () =>
	new Set(
		readdirSync('.').filter((f) => f.startsWith('qasphere-automapping-') && f.endsWith('.txt'))
	)

const cleanupGeneratedMappingFiles = (existingMappingFiles?: Set<string>) => {
	const currentFiles = getMappingFiles()
	currentFiles.forEach((f) => {
		if (!existingMappingFiles?.has(f)) {
			unlinkSync(f)
		}
	})
}

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

describe('Hyphenless test case markers (pytest style)', () => {
	const junitBasePath = './src/tests/fixtures/junit-xml'

	describe('Uploading with --run-url', () => {
		test('Hyphenless markers in JUnit XML should be mapped to run test cases', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(`junit-upload -r ${runURL} ${junitBasePath}/hyphenless-matching-tcases.xml`)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})

	describe('Uploading with auto-detected project code', () => {
		test('Project code should be auto-detected from hyphenless markers', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(`junit-upload ${junitBasePath}/hyphenless-matching-tcases.xml`)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})

	describe('Uploading with --project-code', () => {
		test('Explicit project code with hyphenless markers should work', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(
				`junit-upload --project-code ${projectCode} ${junitBasePath}/hyphenless-matching-tcases.xml`
			)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})
})

describe('CamelCase test case markers (Go/Java style)', () => {
	const junitBasePath = './src/tests/fixtures/junit-xml'

	describe('Uploading with --run-url', () => {
		test('CamelCase markers in JUnit XML should be mapped to run test cases', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(`junit-upload -r ${runURL} ${junitBasePath}/camelcase-matching-tcases.xml`)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})

	describe('Uploading with auto-detected project code', () => {
		test('Project code should be auto-detected from CamelCase markers', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(`junit-upload ${junitBasePath}/camelcase-matching-tcases.xml`)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})

	describe('Uploading with --project-code', () => {
		test('Explicit project code with CamelCase markers should work', async () => {
			const numResultUploadCalls = countResultUploadApiCalls()
			await run(
				`junit-upload --project-code ${projectCode} ${junitBasePath}/camelcase-matching-tcases.xml`
			)
			expect(numResultUploadCalls()).toBe(1) // 5 results total
		})
	})
})

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
					const numFileUploadCalls = countFileUploadApiCalls()
					const numResultUploadCalls = countResultUploadApiCalls()
					await run(pattern)
					expect(numFileUploadCalls()).toBe(0)
					expect(numResultUploadCalls()).toBe(1) // 5 results total
				}
			})

			test('Passing correct Run URL pattern without https, should result in success', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(1)
				await run(
					`${fileType.command} -r ${qasHost}/project/${projectCode}/run/${runId} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(5) // 5 results total
			})

			test('Passing incorrect Run URL pattern should result in failure', async () => {
				const patterns = [
					`${fileType.command} -r ${qasHost}/projects/${projectCode}/runs/${runId} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
					`${fileType.command} -r ${runURL}abc/tcase/1 ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`,
				]

				for (const pattern of patterns) {
					const numFileUploadCalls = countFileUploadApiCalls()
					const numResultUploadCalls = countResultUploadApiCalls()
					let isError = false

					try {
						await run(pattern)
					} catch {
						isError = true
					}
					expect(isError).toBeTruthy()
					expect(numFileUploadCalls()).toBe(0)
					expect(numResultUploadCalls()).toBe(0)
				}
			})
		})

		describe('Uploading test results with run URL', () => {
			test('Test cases on reports with all matching test cases on QAS should be successful', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(2)
				await run(
					`${fileType.command} -r ${runURL} ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(3) // 5 results total
			})

			test('Test cases on reports with a missing test case on QAS should throw an error', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				await expect(
					run(
						`${fileType.command} -r ${runURL} ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
					)
				).rejects.toThrowError()
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(0)
			})

			test('Test cases on reports with a missing test case on QAS should be successful when forced', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(3)
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(2) // 4 results total
			})

			test('Test cases on reports with missing test cases should be successful with --ignore-unmatched', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --ignore-unmatched ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(1) // 4 results total
			})

			test('Test cases from multiple reports should be processed successfully', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(2)
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension} ${fileType.dataBasePath}/missing-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(4) // 8 results total
			})

			test('Test suite with empty tcases should not result in error and be skipped', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				await run(
					`${fileType.command} -r ${runURL} --force ${fileType.dataBasePath}/empty-tsuite.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(1) // 1 result total
			})
		})

		describe('Uploading with attachments', () => {
			test('Attachments should be uploaded', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(3)
				await run(
					`${fileType.command} -r ${runURL} --attachments ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(5)
				expect(numResultUploadCalls()).toBe(2) // 5 results total
			})
			test('Missing attachments should throw an error', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				await expect(
					run(
						`${fileType.command} -r ${runURL} --attachments ${fileType.dataBasePath}/missing-attachments.${fileType.fileExtension}`
					)
				).rejects.toThrow()
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(0)
			})
			test('Missing attachments should be successful when forced', async () => {
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()
				setMaxResultsInRequest(1)
				await run(
					`${fileType.command} -r ${runURL} --attachments --force ${fileType.dataBasePath}/missing-attachments.${fileType.fileExtension}`
				)
				expect(numFileUploadCalls()).toBe(4)
				expect(numResultUploadCalls()).toBe(5) // 5 results total
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
				const numFileUploadCalls = countFileUploadApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()

				createRunTitleConflict = true
				await run(
					`${fileType.command} --run-name "duplicate run title" ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)

				expect(lastCreatedRunTitle).toBe('duplicate run title')
				expect(numFileUploadCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(1) // 5 results total
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

		describe('Uploading test results with test case creation', () => {
			let existingMappingFiles: Set<string> | undefined = undefined

			beforeEach(() => {
				existingMappingFiles = getMappingFiles()
			})

			afterEach(() => {
				cleanupGeneratedMappingFiles(existingMappingFiles)
				existingMappingFiles = undefined
				createTCasesResponse = null
				overriddenGetPaginatedTCasesResponse = null
				overriddenGetFoldersResponse = null
			})

			test('Should create new test cases for results without valid markers', async () => {
				const numCreateTCasesCalls = countCreateTCasesApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()

				setMaxResultsInRequest(1)
				createTCasesResponse = {
					tcases: [
						{ id: '6', seq: 6 },
						{ id: '7', seq: 7 },
					],
				}

				await run(
					`${fileType.command} --project-code ${projectCode} --create-tcases ${fileType.dataBasePath}/without-markers.${fileType.fileExtension}`
				)
				expect(numCreateTCasesCalls()).toBe(1)
				expect(numResultUploadCalls()).toBe(3) // 3 results total
			})

			test('Should not create new test case if one with same title already exists', async () => {
				const numCreateTCasesCalls = countCreateTCasesApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()

				setMaxResultsInRequest(1)
				overriddenGetFoldersResponse = {
					data: [{ id: 1, title: DEFAULT_FOLDER_TITLE, parentId: 0, pos: 0 }],
					total: 1,
					page: 1,
					limit: 50,
				}
				overriddenGetPaginatedTCasesResponse = {
					data: [
						{
							id: '6',
							seq: 6,
							title: 'The cart is still filled after refreshing the page',
							version: 1,
							projectId: 'projectid',
							folderId: 1,
						},
					],
					total: 1,
					page: 1,
					limit: 50,
				}
				createTCasesResponse = {
					tcases: [{ id: '7', seq: 7 }],
				}

				await run(
					`${fileType.command} --project-code ${projectCode} --create-tcases ${fileType.dataBasePath}/without-markers.${fileType.fileExtension}`
				)
				expect(numCreateTCasesCalls()).toBe(1)
				expect(numResultUploadCalls()).toBe(3) // 3 results total
			})

			test('Should not create new test cases if all results have valid markers', async () => {
				const numCreateTCasesCalls = countCreateTCasesApiCalls()
				const numResultUploadCalls = countResultUploadApiCalls()

				setMaxResultsInRequest(1)
				await run(
					`${fileType.command} --project-code ${projectCode} --create-tcases ${fileType.dataBasePath}/matching-tcases.${fileType.fileExtension}`
				)
				expect(numCreateTCasesCalls()).toBe(0)
				expect(numResultUploadCalls()).toBe(5) // 5 results total
			})
		})
	})
})
