import { TestCaseResult } from './types'

export interface TCaseTarget {
	id: string
	seq: number
	title: string
}

export interface TCaseWithResult<T extends TCaseTarget = TCaseTarget> {
	tcase: T
	result: TestCaseResult
}

export interface DuplicateTCaseMapping<T extends TCaseTarget = TCaseTarget> {
	tcase: T
	results: TestCaseResult[]
}

export const mapResolvedResultsToTCases = <T extends TCaseTarget>(
	projectCode: string,
	testcaseResults: TestCaseResult[],
	testcases: T[]
) => {
	const testcasesBySeq = new Map(testcases.map((tcase) => [tcase.seq, tcase]))
	const results: TCaseWithResult<T>[] = []
	const missing: TestCaseResult[] = []

	testcaseResults.forEach((result) => {
		if (result.marker && result.marker.projectCode.toLowerCase() === projectCode.toLowerCase()) {
			const tcase = testcasesBySeq.get(result.marker.seq)
			if (tcase) {
				results.push({ result, tcase })
				return
			}
		}
		missing.push(result)
	})

	return { results, missing, duplicates: findDuplicateTCaseMappings(results) }
}

export const findDuplicateTCaseMappings = <T extends TCaseTarget>(
	results: TCaseWithResult<T>[]
): DuplicateTCaseMapping<T>[] => {
	const duplicates = new Map<string, DuplicateTCaseMapping<T>>()

	for (const item of results) {
		const existing = duplicates.get(item.tcase.id)
		if (existing) {
			existing.results.push(item.result)
			continue
		}

		duplicates.set(item.tcase.id, {
			tcase: item.tcase,
			results: [item.result],
		})
	}

	return Array.from(duplicates.values())
		.filter((duplicate) => duplicate.results.length > 1)
		.filter((duplicate) => duplicate.results.some((result) => !result.allowDuplicateTarget))
}
