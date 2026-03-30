import { existsSync, statSync } from 'node:fs'
import { loadEnvs } from '../../utils/env'
import { createApi } from '../../api/index'
import {
	ArgumentValidationError,
	collectFieldValues,
	collectPathParamValues,
	collectQueryValues,
	handleApiValidationError,
	kebabToCamelCase,
	mergeBodyWithFields,
	parseBodyInput,
	validateFieldValues,
	validateOptionValues,
} from './utils'
import type { ApiEndpointSpec } from './types'

/**
 * Executes a manifest-based API command.
 * Orchestrates: path param validation → field validation → transform → merge → API call → error mapping.
 */
export async function executeCommand(
	spec: ApiEndpointSpec,
	args: Record<string, unknown>
): Promise<void> {
	// 1. Collect and validate path params
	const pathParams = collectPathParamValues(args, spec.pathParams)
	const paramIssues = validateOptionValues(pathParams, spec.pathParams)

	// 2. Process body based on bodyMode
	let body: unknown = undefined

	if (spec.bodyMode === 'json') {
		const fieldOptions = spec.fieldOptions ?? []
		let fieldIssues: { argument: string; message: string }[] = []

		if (fieldOptions.length > 0) {
			// Collect and validate individual field values
			const fieldValues = collectFieldValues(args, fieldOptions)
			fieldIssues = validateFieldValues(fieldValues, fieldOptions)

			// If any path param or field errors, throw all at once
			const allIssues = [...paramIssues, ...fieldIssues]
			if (allIssues.length > 0) {
				throw new ArgumentValidationError(allIssues)
			}

			// Transform validated field values into body fragment
			const transform = spec.transformFields ?? kebabToCamelCase
			const transformedFields = transform(fieldValues)

			// Parse --body / --body-file if provided
			const bodyBase = parseBodyInput(args)

			// Merge: field values override body values
			body =
				transformedFields != null && typeof transformedFields === 'object'
					? mergeBodyWithFields(bodyBase, transformedFields as Record<string, unknown>)
					: (bodyBase ?? transformedFields)
		} else {
			// No field options — just parse body input
			if (paramIssues.length > 0) {
				throw new ArgumentValidationError(paramIssues)
			}
			body = parseBodyInput(args)
		}
	} else if (spec.bodyMode === 'file') {
		if (paramIssues.length > 0) {
			throw new ArgumentValidationError(paramIssues)
		}
		const filePath = args['file'] as string
		if (!existsSync(filePath)) {
			throw new Error(`File not found: ${filePath}`)
		}
		if (spec.maxSize !== undefined) {
			const fileSize = statSync(filePath).size
			if (fileSize > spec.maxSize) {
				const maxMiB = (spec.maxSize / (1024 * 1024)).toFixed(0)
				throw new Error(
					`File size (${(fileSize / (1024 * 1024)).toFixed(1)} MiB) exceeds the maximum allowed size of ${maxMiB} MiB`
				)
			}
		}
		body = filePath
	} else {
		// bodyMode === 'none'
		if (paramIssues.length > 0) {
			throw new ArgumentValidationError(paramIssues)
		}
	}

	// 3. Collect, validate, and transform query values
	const queryOptions = spec.queryOptions ?? []
	const rawQuery = collectQueryValues(args, queryOptions)
	const queryIssues = validateOptionValues(rawQuery, queryOptions)
	if (queryIssues.length > 0) {
		throw new ArgumentValidationError(queryIssues)
	}
	const transformQuery = spec.transformQuery ?? kebabToCamelCase
	const query = transformQuery(rawQuery)

	// 4. Connect to API (lazy env loading)
	loadEnvs()
	const api = createApi(process.env.QAS_URL!, process.env.QAS_TOKEN!)

	// 5. Build argument map for error mapping
	const argumentMap: Record<string, string> = {}
	if (spec.bodyMode === 'json' && spec.fieldOptions) {
		for (const field of spec.fieldOptions) {
			const camelKey = field.name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
			argumentMap[camelKey] = `--${field.name}`
		}
	}
	for (const opt of queryOptions) {
		const camelKey = opt.name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
		argumentMap[camelKey] = `--${opt.name}`
	}

	// 6. Execute with error mapping
	try {
		await spec.execute(api, { pathParams, query, body })
	} catch (e) {
		handleApiValidationError(e, argumentMap)
	}
}
