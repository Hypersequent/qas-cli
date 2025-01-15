import { gte } from 'semver'
import { REQUIRED_NODE_VERSION } from './config'
import chalk from 'chalk'

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
			'Invalid --run-url specified. Must be in the format: /project/{projectId}/run/{runId}'
		)

		return {
			url: matches[1],
			project: matches[2],
			run: Number(matches[3]),
		}
	}
	throw new Error('Invalid --run-url specified')
}

export const parseProjectUrl = (args: Record<string, unknown>) => {
	if (typeof args.project === 'string') {
		const matches = parseUrl(
			args.project,
			/^(\S+)\/project\/(\w+)(\/\S*)?$/,
			'Invalid --project specified. Must be in the format: /project/{projectId}'
		)

		return {
			url: matches[1],
			project: matches[2],
		}
	}
	throw new Error('Invalid --project specified')
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
