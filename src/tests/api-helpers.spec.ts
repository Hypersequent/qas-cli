import { Readable } from 'node:stream'

import { describe, expect, test } from 'vitest'

import { apiEndpointSpecById } from '../commands/api/manifest'
import { buildApiRequestFromArgs } from '../commands/api/executor'
import { loadJsonBodyInput } from '../commands/api/helpers'

describe('API helper validation', () => {
	test('loads JSON body from inline text', async () => {
		await expect(loadJsonBodyInput({ body: '{"title":"Demo"}' })).resolves.toEqual({
			title: 'Demo',
		})
	})

	test('loads JSON body from file', async () => {
		await expect(
			loadJsonBodyInput({ bodyFile: './src/tests/fixtures/api/create-project.json' })
		).resolves.toEqual({
			code: 'DEMO',
			title: 'Demo Project',
		})
	})

	test('loads JSON body from stdin', async () => {
		await expect(
			loadJsonBodyInput(
				{ bodyStdin: true },
				Readable.from(['{"code":"STDIN","title":"From stdin"}'])
			)
		).resolves.toEqual({
			code: 'STDIN',
			title: 'From stdin',
		})
	})

	test('reports invalid inline JSON with source context', async () => {
		await expect(loadJsonBodyInput({ body: '{"code":' })).rejects.toThrow(
			'Invalid JSON from --body'
		)
	})

	test('reports invalid file JSON with source context', async () => {
		await expect(
			loadJsonBodyInput({ bodyFile: './src/tests/fixtures/api/invalid-body.txt' })
		).rejects.toThrow('Invalid JSON from --body-file ./src/tests/fixtures/api/invalid-body.txt')
	})

	test('reports invalid stdin JSON with source context', async () => {
		await expect(
			loadJsonBodyInput({ bodyStdin: true }, Readable.from(['{"code":']))
		).rejects.toThrow('Invalid JSON from --body-stdin')
	})

	test('rejects non-integer numeric query flags', async () => {
		const spec = apiEndpointSpecById.get('audit-logs.list')!
		await expect(
			buildApiRequestFromArgs(spec, {
				after: 0,
				count: 1.5,
			})
		).rejects.toThrow('--count must be a finite integer.')
	})

	test('rejects malformed custom field filters', async () => {
		const spec = apiEndpointSpecById.get('testcases.list')!
		await expect(
			buildApiRequestFromArgs(spec, {
				project: 'DEMO',
				cf: ['automation'],
			})
		).rejects.toThrow('--cf must be exactly key=value with non-empty key and value.')
	})

	test('rejects JSON body flags on file upload commands', async () => {
		const spec = apiEndpointSpecById.get('files.upload')!
		await expect(
			buildApiRequestFromArgs(spec, {
				file: './src/tests/fixtures/api/upload.txt',
				body: '{"ignored":true}',
			})
		).rejects.toThrow('JSON body flags are not supported for this command')
	})

	test('maps repeated query flags and --cf filters into URL params', async () => {
		const spec = apiEndpointSpecById.get('testcases.list')!
		const request = await buildApiRequestFromArgs(spec, {
			project: 'DEMO',
			tags: [12, 13],
			priorities: ['high', 'medium'],
			cf: ['automation=Automated', 'automation=Planned', 'owner=QA'],
		})

		expect(request.pathname).toBe('/api/public/v0/project/DEMO/tcase')
		expect(request.query?.getAll('tags')).toEqual(['12', '13'])
		expect(request.query?.getAll('priorities')).toEqual(['high', 'medium'])
		expect(request.query?.getAll('cf_automation')).toEqual(['Automated', 'Planned'])
		expect(request.query?.getAll('cf_owner')).toEqual(['QA'])
	})

	test('normalizes update test case request before schema validation', async () => {
		const spec = apiEndpointSpecById.get('testcases.update')!
		const request = await buildApiRequestFromArgs(spec, {
			project: 'DEMO',
			tcase: '123',
			body: JSON.stringify({
				title: 'Updated',
				precondition: { id: 42 },
				steps: [{ sharedStepId: 10 }],
			}),
		})

		expect(request.pathname).toBe('/api/public/v0/project/DEMO/tcase/123')
		expect(request.jsonBody).toEqual({
			title: 'Updated',
			requirements: null,
			links: null,
			tags: null,
			steps: [{ sharedStepId: 10, description: '', expected: '' }],
			files: null,
			precondition: { sharedPreconditionId: 42 },
		})
	})
})
