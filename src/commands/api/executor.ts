import { existsSync, statSync } from 'node:fs'
import { resolveAuth } from '../../utils/credentials'
import { createApi } from '../../api/index'
import {
	ArgumentValidationError,
	type ArgumentValidationIssue,
	collectFieldValues,
	collectPathParamValues,
	collectQueryValues,
	handleApiValidationError,
	kebabToCamel,
	kebabToCamelCaseKeys,
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
	let fieldIssues: ArgumentValidationIssue[] = []

	if (spec.bodyMode === 'json') {
		const fieldOptions = spec.fieldOptions ?? []

		if (fieldOptions.length > 0) {
			// Collect and validate individual field values
			const fieldValues = collectFieldValues(args, fieldOptions)
			fieldIssues = validateFieldValues(fieldValues, fieldOptions)

			// Only process body if no param/field errors (body parsing depends on valid inputs)
			if (paramIssues.length === 0 && fieldIssues.length === 0) {
				// Transform validated field values into body fragment
				const transform = spec.transformFields ?? kebabToCamelCaseKeys
				const transformedFields = transform(fieldValues)

				// Parse --body / --body-file if provided
				const bodyBase = parseBodyInput(args)

				// Merge: field values override body values
				body =
					transformedFields != null && typeof transformedFields === 'object'
						? mergeBodyWithFields(bodyBase, transformedFields as Record<string, unknown>)
						: (bodyBase ?? transformedFields)
			}
		} else {
			// No field options — only parse body input if params are valid
			if (paramIssues.length === 0) {
				body = parseBodyInput(args)
			}
		}
	} else if (spec.bodyMode === 'file') {
		if (paramIssues.length === 0) {
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
		}
	}

	// 3. Collect, validate, and transform query values
	const queryOptions = spec.queryOptions ?? []
	const rawQuery = collectQueryValues(args, queryOptions)
	const queryIssues = validateOptionValues(rawQuery, queryOptions)

	// Throw all validation issues together
	const allIssues = [...paramIssues, ...fieldIssues, ...queryIssues]
	if (allIssues.length > 0) {
		throw new ArgumentValidationError(allIssues)
	}
	const transformQuery = spec.transformQuery ?? kebabToCamelCaseKeys
	const query = transformQuery(rawQuery)

	// 4. Connect to API (lazy auth resolution)
	const auth = await resolveAuth()
	const api = createApi(auth.baseUrl, auth.token, auth.authType)

	// 5. Build argument map for error mapping
	const argumentMap: Record<string, string> = {}
	if (spec.bodyMode === 'json' && spec.fieldOptions) {
		for (const field of spec.fieldOptions) {
			const camelKey = kebabToCamel(field.name)
			argumentMap[camelKey] = `--${field.name}`
		}
	}
	for (const opt of queryOptions) {
		const camelKey = kebabToCamel(opt.name)
		argumentMap[camelKey] = `--${opt.name}`
	}

	// 6. Execute with error mapping
	try {
		await spec.execute(api, { pathParams, query, body })
	} catch (e) {
		handleApiValidationError(e, argumentMap)
	}
}
