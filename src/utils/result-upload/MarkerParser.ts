import { UploadCommandType } from './ResultUploadCommandHandler'

const MARKER_SEP = `_`
const LOOKS_LIKE_TEST_FN = /^test/i

/** Convert a string like "BD026" to a case-insensitive regex fragment "[bB][dD]026" */
const toCaseInsensitive = (str: string): string =>
	str.replace(/[a-zA-Z]/g, (ch) => {
		const lower = ch.toLowerCase()
		const upper = ch.toUpperCase()
		return `[${lower}${upper}]`
	})

/** Try matching at start, then end, then anywhere — return first match. */
const execRegexWithPriority = (
	pattern: string,
	str: string,
	flags: string = ''
): RegExpExecArray | null => {
	const startRegex = new RegExp(`^${pattern}`, flags)
	let match = startRegex.exec(str)
	if (match) return match

	const endRegex = new RegExp(`${pattern}$`, flags)
	match = endRegex.exec(str)
	if (match) return match

	const anywhereRegex = new RegExp(pattern, flags)
	return anywhereRegex.exec(str)
}

/** Also exported as a standalone function for parsers that just need formatting */
export const formatMarker = (projectCode: string, seq: number) =>
	`${projectCode}-${seq.toString().padStart(3, '0')}`

export class MarkerParser {
	constructor(private type: UploadCommandType) {}

	/** Canonical hyphenated marker for API communication: "TEST-002" */
	formatMarker(projectCode: string, seq: number): string {
		return formatMarker(projectCode, seq)
	}

	/**
	 * Try to detect a project code from a test name.
	 * Returns uppercase project code or null.
	 * Tries hyphenated first (PRJ-123), then hyphenless for JUnit only.
	 */
	detectProjectCode(name: string): string | null {
		// 1. Hyphenated: PRJ-123
		// Case-sensitive, returns code as-is (no uppercasing). Hyphenated markers appear
		// in annotations or string literals where there's no reason to use wrong case.
		const hyphenatedPattern = String.raw`([A-Za-z0-9]{1,5})-\d{3,}`
		const hyphenatedMatch = execRegexWithPriority(hyphenatedPattern, name)
		if (hyphenatedMatch) {
			return hyphenatedMatch[1]
		}

		if (this.type !== 'junit-upload' || !LOOKS_LIKE_TEST_FN.test(name)) {
			return null
		}

		// Hyphenless patterns use letters-only for project codes ([A-Za-z]{1,5}).
		// Alphanumeric codes (e.g., "BD026") won't work here because without a hyphen
		// delimiter there's no way to tell where the code ends and the sequence starts
		// (e.g., "BD026123" is ambiguous). This is a known limitation — projects using
		// numeric characters in their code must use hyphenated markers.

		// 2. Separator-bounded hyphenless: test_prj123_foo
		const sepPattern = String.raw`(?:^|${MARKER_SEP})([A-Za-z]{1,5})(\d{3,})(?:$|${MARKER_SEP})`
		const sepMatch = execRegexWithPriority(sepPattern, name, 'i')
		if (sepMatch) {
			return sepMatch[1].toUpperCase()
		}

		// 3. CamelCase start: TestPrj123Foo
		const camelStartMatch = /^[tT][eE][sS][tT]([A-Za-z]{1,5})(\d{3,})(?=[A-Z]|$)/.exec(name)
		if (camelStartMatch) {
			return camelStartMatch[1].toUpperCase()
		}

		// 4. CamelCase end: TestFooPrj123
		const camelEndMatch = /(?<=[a-z])([A-Z][A-Za-z]{0,4})(\d{3,})$/.exec(name)
		if (camelEndMatch) {
			return camelEndMatch[1].toUpperCase()
		}

		return null
	}

	/**
	 * Try to extract a sequence number for a known project code.
	 * Returns the seq number or null.
	 * Tries hyphenated first, then hyphenless for JUnit only.
	 */
	extractSeq(name: string, projectCode: string): number | null {
		// 1. Hyphenated: PRJ-123
		const hyphenatedPattern = String.raw`${projectCode}-(\d{3,})`
		const hyphenatedMatch = execRegexWithPriority(hyphenatedPattern, name)
		if (hyphenatedMatch) {
			return Number(hyphenatedMatch[1])
		}

		if (this.type !== 'junit-upload' || !LOOKS_LIKE_TEST_FN.test(name)) {
			return null
		}

		const ciCode = toCaseInsensitive(projectCode)

		// 2. Separator-bounded hyphenless: test_prj123_foo
		const sepPattern = String.raw`(?:^|${MARKER_SEP})${ciCode}(\d{3,})(?:$|${MARKER_SEP})`
		const sepMatch = execRegexWithPriority(sepPattern, name, 'i')
		if (sepMatch) {
			return Number(sepMatch[1])
		}

		// 3. CamelCase start: TestPrj123Foo
		const camelStartPattern = `^[tT][eE][sS][tT]${ciCode}(\\d{3,})(?=[A-Z]|$)`
		const camelStartMatch = new RegExp(camelStartPattern).exec(name)
		if (camelStartMatch) {
			return Number(camelStartMatch[1])
		}

		// 4. CamelCase end: TestFooPrj123
		const camelEndPattern = `(?<=[a-z])${ciCode}(\\d{3,})$`
		const camelEndMatch = new RegExp(camelEndPattern).exec(name)
		if (camelEndMatch) {
			return Number(camelEndMatch[1])
		}

		return null
	}

	/**
	 * Check if a test result name matches a specific test case.
	 * Used by ResultUploader to map results → run test cases.
	 */
	nameMatchesTCase(name: string, projectCode: string, seq: number): boolean {
		// 1. Hyphenated: case-insensitive check with hyphenated marker (e.g., TEST-002)
		const hyphenated = formatMarker(projectCode, seq)
		if (name.toLowerCase().includes(hyphenated.toLowerCase())) {
			return true
		}

		if (this.type !== 'junit-upload' || !LOOKS_LIKE_TEST_FN.test(name)) {
			return false
		}

		const ciCode = toCaseInsensitive(projectCode)
		const seqStr = seq.toString().padStart(3, '0')

		// 2. Separator-bounded hyphenless: test_prj002_foo
		const sepPattern = new RegExp(`(?:^|${MARKER_SEP})${ciCode}${seqStr}(?:$|${MARKER_SEP})`, 'i')
		if (sepPattern.test(name)) {
			return true
		}

		// 3. CamelCase start: TestPrj002Foo
		const camelStartPattern = new RegExp(`^[tT][eE][sS][tT]${ciCode}${seqStr}(?=[A-Z]|$)`)
		if (camelStartPattern.test(name)) {
			return true
		}

		// 4. CamelCase end: TestFooPrj002
		const camelEndPattern = new RegExp(`(?<=[a-z])${ciCode}${seqStr}$`)
		if (camelEndPattern.test(name)) {
			return true
		}

		return false
	}
}
