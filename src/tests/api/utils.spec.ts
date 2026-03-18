import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { describe, test, expect, beforeAll, afterAll } from 'vitest'
import { z } from 'zod'
import { parseAndValidateJsonArg, validateWithSchema } from '../../commands/api/utils'

describe('parseAndValidateJsonArg', () => {
	let tempDir: string

	beforeAll(() => {
		tempDir = mkdtempSync(join(tmpdir(), 'qas-api-utils-'))
	})

	afterAll(() => {
		rmSync(tempDir, { recursive: true })
	})

	const passthrough = z.unknown()

	test('parses inline JSON', () => {
		expect(
			parseAndValidateJsonArg('[{"tcaseIds": ["abc"]}]', '--query-plans', passthrough)
		).toEqual([{ tcaseIds: ['abc'] }])
	})

	test('parses JSON from @filename', () => {
		const filePath = join(tempDir, 'plans.json')
		writeFileSync(filePath, '[{"folderIds": [1, 2]}]')
		expect(parseAndValidateJsonArg(`@${filePath}`, '--query-plans', passthrough)).toEqual([
			{ folderIds: [1, 2] },
		])
	})

	test('parses JSON from relative @./filename', () => {
		const filePath = join(tempDir, 'relative.json')
		writeFileSync(filePath, '{"key": "value"}')
		const relativePath = `./${relative(process.cwd(), filePath)}`
		expect(parseAndValidateJsonArg(`@${relativePath}`, '--data', passthrough)).toEqual({
			key: 'value',
		})
	})

	test('throws on invalid inline JSON with helpful message', () => {
		expect(() => parseAndValidateJsonArg('not-json', '--query-plans', passthrough)).toThrow(
			/Failed to parse --query-plans as JSON/
		)
		expect(() => parseAndValidateJsonArg('not-json', '--query-plans', passthrough)).toThrow(
			/@filename/
		)
	})

	test('throws on bare @ with no filename', () => {
		expect(() => parseAndValidateJsonArg('@', '--query-plans', passthrough)).toThrow(
			/must be followed by a file path/
		)
	})

	test('throws on @filename when file does not exist', () => {
		expect(() =>
			parseAndValidateJsonArg('@nonexistent.json', '--query-plans', passthrough)
		).toThrow(/File not found for --query-plans: nonexistent.json/)
	})

	test('throws on @filename when file contains invalid JSON', () => {
		const filePath = join(tempDir, 'bad.json')
		writeFileSync(filePath, '{not valid json}')
		expect(() => parseAndValidateJsonArg(`@${filePath}`, '--query-plans', passthrough)).toThrow(
			/Failed to parse JSON from file/
		)
	})

	test('parses and validates valid JSON against a schema', () => {
		const schema = z.array(z.object({ id: z.string() })).min(1, 'must have at least one item')
		expect(parseAndValidateJsonArg('[{"id": "abc"}]', '--items', schema)).toEqual([{ id: 'abc' }])
	})

	test('throws parse error for invalid JSON before validation', () => {
		const schema = z.array(z.object({ id: z.string() })).min(1, 'must have at least one item')
		expect(() => parseAndValidateJsonArg('bad', '--items', schema)).toThrow(
			/Failed to parse --items as JSON/
		)
	})

	test('throws validation error for valid JSON that fails schema', () => {
		const schema = z.array(z.object({ id: z.string() })).min(1, 'must have at least one item')
		expect(() => parseAndValidateJsonArg('[]', '--items', schema)).toThrow(
			/Validation failed for --items/
		)
		expect(() => parseAndValidateJsonArg('[]', '--items', schema)).toThrow(
			/must have at least one item/
		)
	})

	test('shows index in error for array of objects', () => {
		const schema = z.array(z.object({ id: z.string(), count: z.number() }))
		expect(() =>
			parseAndValidateJsonArg(
				'[{"id": "ok", "count": 1}, {"id": 123, "count": "bad"}]',
				'--items',
				schema
			)
		).toThrow(/1\.id:/)
		expect(() =>
			parseAndValidateJsonArg(
				'[{"id": "ok", "count": 1}, {"id": 123, "count": "bad"}]',
				'--items',
				schema
			)
		).toThrow(/1\.count:/)
	})

	test('shows index in error for array of primitives', () => {
		const schema = z.array(z.number())
		expect(() => parseAndValidateJsonArg('[1, 2, "three"]', '--values', schema)).toThrow(/2:/)
	})

	test('shows multiple validation errors for a single field', () => {
		const schema = z.object({
			code: z
				.string()
				.min(3, 'must be at least 3 characters')
				.refine((s) => /^[A-Z]+$/.test(s), 'must contain only uppercase letters'),
		})
		expect(() => parseAndValidateJsonArg('{"code": "ab"}', '--data', schema)).toThrow(
			/must be at least 3 characters/
		)
		expect(() => parseAndValidateJsonArg('{"code": "ab"}', '--data', schema)).toThrow(
			/must contain only uppercase letters/
		)
	})
})

describe('validateWithSchema', () => {
	const schema = z.object({
		name: z.string().min(1, 'name must not be empty'),
		count: z.number().int().positive('count must be a positive integer'),
	})

	test('returns validated value on success', () => {
		const result = validateWithSchema({ name: 'test', count: 5 }, '--options', schema)
		expect(result).toEqual({ name: 'test', count: 5 })
	})

	test('throws with formatted error on validation failure', () => {
		expect(() => validateWithSchema({ name: '', count: -1 }, '--options', schema)).toThrow(
			/Validation failed for --options/
		)
		expect(() => validateWithSchema({ name: '', count: -1 }, '--options', schema)).toThrow(
			/name: name must not be empty/
		)
		expect(() => validateWithSchema({ name: '', count: -1 }, '--options', schema)).toThrow(
			/count: count must be a positive integer/
		)
	})

	test('includes field path in error message', () => {
		const arraySchema = z.array(z.object({ id: z.string() }))
		expect(() => validateWithSchema([{ id: 'ok' }, { id: 123 }], '--items', arraySchema)).toThrow(
			/1\.id:/
		)
	})
})
