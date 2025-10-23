import { gte } from 'semver'
import { REQUIRED_NODE_VERSION } from './config'
import chalk from 'chalk'

export const monthNames = [
	'Jan',
	'Feb',
	'Mar',
	'Apr',
	'May',
	'Jun',
	'Jul',
	'Aug',
	'Sep',
	'Oct',
	'Nov',
	'Dec',
]

export const twirlLoader = () => {
	const chars = ['\\', '|', '/', '-']
	let x = 0
	let timer: NodeJS.Timeout | null = null
	let text: string | null = null
	const update = () => {
		const char = `\r${chars[x++]}`
		const outText = text ? char + ` ${text}` : char

		process.stdout.write(outText)
		x %= chars.length
	}
	return {
		start: (startText: string | null = null) => {
			text = startText
			timer = setInterval(() => {
				update()
			}, 250)
		},
		stop: () => {
			if (timer) {
				clearInterval(timer)
			}
			process.stdout.write('\n')
		},
		setText: (newText: string) => {
			text = newText
			update()
		},
	}
}

const parseUrl = (url: string, pattern: RegExp, errorMessage: string) => {
	if (!url.includes('://')) {
		url = `https://${url}`
	}

	const matches = url.match(pattern)
	if (matches) {
		return matches
	}

	throw new Error(errorMessage)
}

export const parseRunUrl = (args: Record<string, unknown>) => {
	if (typeof args.runUrl === 'string') {
		const matches = parseUrl(
			args.runUrl,
			/^(\S+)\/project\/(\w+)\/run\/(\d+)(\/\S*)?$/,
			'Invalid --run-url specified. Must be in the format: https://example.com/project/PROJECT/run/RUN'
		)

		return {
			url: matches[1],
			project: matches[2],
			run: Number(matches[3]),
		}
	}
	throw new Error('--run-url is required but not provided.')
}

export const parseTCaseUrl = (url: string) => {
	if (!url.includes('://')) {
		url = `https://${url}`
	}

	const matches = url.match(/^(\S+)\/project\/(\w+)\/tcase\/(\d+)(\/|\?|$)/)
	if (matches) {
		return {
			url: matches[1],
			project: matches[2],
			tcaseSeq: Number(matches[3]),
		}
	}
}

export const printErrorThenExit = (e: unknown): never => {
	printError(e)
	process.exit(1)
}

export const printError = (e: unknown) => {
	const isVerbose = process.argv.some((arg) => arg === '--verbose')
	let message = e

	if (!isVerbose) {
		if (e instanceof Error) {
			message = e.message
		}
	}
	message = `${chalk.red('Error:')} ${message}`

	console.error(message)
}

export const validateNodeVersion = () => {
	return gte(process.version, REQUIRED_NODE_VERSION)
}

/**
 * Processes template placeholders in a string with environment variables and date components
 * Supported placeholders:
 * - {env:VAR_NAME} - Environment variables
 * - {YYYY} - 4-digit year
 * - {YY} - 2-digit year
 * - {MMM} - 3-letter month (e.g., Jan, Feb, Mar)
 * - {MM} - 2-digit month
 * - {DD} - 2-digit day
 * - {HH} - 2-digit hour (24-hour format)
 * - {hh} - 2-digit hour (12-hour format)
 * - {mm} - 2-digit minute
 * - {ss} - 2-digit second
 * - {AMPM} - AM/PM indicator
 *
 * The `date` parameter is optional and defaults to the current date and time.
 */
export const processTemplate = (template: string, date?: Date): string => {
	date = date ?? new Date()

	// Get 12-hour format hour and AM/PM
	const hour24 = date.getHours()
	const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
	const ampm = hour24 < 12 ? 'AM' : 'PM'

	return (
		template
			// Environment variables: {env:VAR_NAME}
			.replace(/\{env:([^}]+)\}/g, (_, varName) => {
				const value = process.env[varName]
				return value !== undefined ? value : `{env:${varName}}`
			})
			// Date placeholders
			.replace(/\{YYYY\}/g, String(date.getFullYear()))
			.replace(/\{YY\}/g, String(date.getFullYear()).slice(-2))
			.replace(/\{MMM\}/g, monthNames[date.getMonth()])
			.replace(/\{MM\}/g, String(date.getMonth() + 1).padStart(2, '0'))
			.replace(/\{DD\}/g, String(date.getDate()).padStart(2, '0'))
			.replace(/\{HH\}/g, String(hour24).padStart(2, '0'))
			.replace(/\{hh\}/g, String(hour12).padStart(2, '0'))
			.replace(/\{mm\}/g, String(date.getMinutes()).padStart(2, '0'))
			.replace(/\{ss\}/g, String(date.getSeconds()).padStart(2, '0'))
			.replace(/\{AMPM\}/g, ampm)
	)
}
