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

export const parseRunUrl = (args: Record<string, unknown>) => {
	if (typeof args.runUrl === 'string') {
		let runUrl = args.runUrl
		if (!runUrl.includes('://')) {
			runUrl = `https://${runUrl}`
		}

		const matches = runUrl.match(/^(\S+)\/project\/(\w+)\/run\/(\d+)(\/\S*)?$/)
		if (matches && matches.length === 5) {
			return {
				url: matches[1],
				project: matches[2],
				run: Number(matches[3]),
			}
		}
	}
	throw new Error('invalid --run-url specified')
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