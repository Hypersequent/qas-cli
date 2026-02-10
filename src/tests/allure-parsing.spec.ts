import { afterEach, describe, expect, test } from 'vitest'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseAllureResults } from '../utils/result-upload/allureParser'

const allureBasePath = './src/tests/fixtures/allure'
const tempDirsToCleanup: string[] = []

const makeResult = (overrides: Record<string, unknown> = {}) => ({
	name: 'Sample test',
	status: 'passed',
	uuid: 'result-uuid',
	start: 1000,
	stop: 1200,
	...overrides,
})

const createTempAllureDir = async (files: Record<string, string>) => {
	const dir = await mkdtemp(join(tmpdir(), 'qas-allure-fixture-'))
	tempDirsToCleanup.push(dir)

	await Promise.all(
		Object.entries(files).map(([name, content]) => writeFile(join(dir, name), content, 'utf8'))
	)
	return dir
}

afterEach(async () => {
	await Promise.all(
		tempDirsToCleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true }))
	)
})

describe('Allure parsing', () => {
	test('Should parse matching directory with marker extraction and status mapping', async () => {
		const dir = `${allureBasePath}/matching-tcases`
		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
			allowPartialParse: false,
		})

		expect(testcases).toHaveLength(5)
		expect(testcases[0].name).toBe('TEST-002: Test cart')
		expect(testcases[1].name).toBe('TEST-003: Test checkout')
		expect(testcases[2].name).toBe('TEST-004: About page content TEST-004')
		expect(testcases[3].name).toBe('TEST-006: Navigation bar items')
		expect(testcases[4].name).toBe('TEST-007: Welcome page content (updated)')

		expect(testcases[0].folder).toBe('ui.cart.spec.ts')
		expect(testcases[1].folder).toBe('ui.cart.spec.ts')
		expect(testcases[2].folder).toBe('ui.contents.spec.ts')
		expect(testcases[3].folder).toBe('ui.contents.spec.ts')
		expect(testcases[4].folder).toBe('')

		expect(testcases[0].timeTaken).toBe(500)
		expect(testcases[3].status).toBe('failed')
		expect(testcases[4].status).toBe('open')
		expect(testcases[3].message).toContain('AssertionError: navbar items mismatch')
		expect(testcases[3].message).toContain('Traceback line 2')

		testcases.forEach((tcase) => {
			expect(tcase.attachments).toHaveLength(1)
			expect(tcase.attachments[0].buffer).not.toBeNull()
			expect(tcase.attachments[0].error).toBeNull()
		})
	})

	test('Should map broken and skipped statuses correctly', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({ name: 'TEST-100 Broken test', status: 'broken' })
			),
			'002-result.json': JSON.stringify(
				makeResult({ name: 'TEST-101 Skipped test', status: 'skipped' })
			),
		})

		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
		expect(testcases).toHaveLength(2)
		expect(testcases[0].status).toBe('blocked')
		expect(testcases[1].status).toBe('skipped')
	})

	test('Should honor skip-report options for message and trace blocks', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-200 Passed with status details',
					statusDetails: {
						message: 'stdout-like text',
						trace: 'stderr-like text',
					},
				})
			),
		})

		const skippedOnSuccess = await parseAllureResults(dir, dir, {
			skipStdout: 'on-success',
			skipStderr: 'on-success',
		})
		expect(skippedOnSuccess[0].message).toBe('')

		const neverSkip = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
		expect(neverSkip[0].message).toContain('stdout-like text')
		expect(neverSkip[0].message).toContain('stderr-like text')
	})

	test('Should apply folder priority suite > parentSuite > feature > package', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-301 has suite and parentSuite',
					labels: [
						{ name: 'parentSuite', value: 'parent-folder' },
						{ name: 'suite', value: 'suite-folder' },
					],
				})
			),
			'002-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-302 has parentSuite and feature',
					labels: [
						{ name: 'feature', value: 'feature-folder' },
						{ name: 'parentSuite', value: 'parent-folder-2' },
					],
				})
			),
			'003-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-303 has feature and package',
					labels: [
						{ name: 'package', value: 'package-folder' },
						{ name: 'feature', value: 'feature-folder-2' },
					],
				})
			),
			'004-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-304 has package',
					labels: [{ name: 'package', value: 'package-only-folder' }],
				})
			),
			'005-result.json': JSON.stringify(makeResult({ name: 'TEST-305 has no labels', labels: [] })),
		})

		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
		})
		expect(testcases).toHaveLength(5)
		expect(testcases[0].folder).toBe('suite-folder')
		expect(testcases[1].folder).toBe('parent-folder-2')
		expect(testcases[2].folder).toBe('feature-folder-2')
		expect(testcases[3].folder).toBe('package-only-folder')
		expect(testcases[4].folder).toBe('')
	})

	test('Should keep attachment errors without crashing parse', async () => {
		const dir = `${allureBasePath}/missing-attachments`
		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(5)
		const erroredAttachments = testcases
			.flatMap((t) => t.attachments)
			.filter((a) => a.error !== null)
		expect(erroredAttachments).toHaveLength(1)
		expect(erroredAttachments[0].buffer).toBeNull()
		expect(erroredAttachments[0].filename).toBe('missing-attachment.txt')
	})

	test('Should fail by default for malformed or schema-invalid files', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-002 Valid result',
				})
			),
			'002-result.json': `{
	"name": "Malformed fixture",
	"status": "passed",
	"uuid": "malformed-uuid",
	"start": 1,
	"stop": 2,`,
		})
		await expect(
			parseAllureResults(dir, dir, {
				skipStdout: 'never',
				skipStderr: 'never',
				allowPartialParse: false,
			})
		).rejects.toThrowError()
	})

	test('Should skip malformed or schema-invalid files when partial parsing is allowed', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-002 Valid result',
				})
			),
			'002-result.json': `{
	"name": "Malformed fixture",
	"status": "passed",
	"uuid": "malformed-uuid",
	"start": 1,
	"stop": 2,`,
			'003-result.json': JSON.stringify({
				name: 'Schema invalid fixture',
				uuid: 'schema-invalid-uuid',
				start: 10,
				stop: 20,
			}),
		})
		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
			allowPartialParse: true,
		})
		expect(testcases).toHaveLength(1)
		expect(testcases[0].name).toContain('TEST-002')
	})

	test('Should prioritize marker extraction as TMS URL > TMS link name > test name', async () => {
		const dir = await createTempAllureDir({
			'001-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-404 marker in test name',
					links: [
						{
							type: 'tms',
							url: 'https://qas.eu1.qasphere.com/project/TEST/tcase/2',
							name: 'TEST-003',
						},
					],
				})
			),
			'002-result.json': JSON.stringify(
				makeResult({
					name: 'TEST-405 marker in test name',
					links: [
						{
							type: 'tms',
							url: 'https://external.example.com/tms/entry',
							name: 'TEST-006',
						},
					],
				})
			),
		})

		const testcases = await parseAllureResults(dir, dir, {
			skipStdout: 'never',
			skipStderr: 'never',
		})

		expect(testcases).toHaveLength(2)
		expect(testcases[0].name).toBe('TEST-002: TEST-404 marker in test name')
		expect(testcases[1].name).toBe('TEST-006: TEST-405 marker in test name')
	})
})
