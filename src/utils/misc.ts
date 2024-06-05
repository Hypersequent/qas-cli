import { API_TOKEN } from '../config/env'

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
			process.stdout.write('\r')
		},
		setText: (newText: string) => {
			text = newText
			update()
		},
	}
}

export const parseUrl = (args: Record<string, unknown>): string => {
	if (typeof args.url === 'string') {
		if (args.url.includes('://')) {
			return args.url
		}
		return `https://${args.url}`
	}
	if (typeof args.s === 'string' && typeof args.z === 'string') {
		return `https://${args.s}.${args.z}.qasphere.com`
	}
	throw new Error('missing parameters -z and -s or --url')
}

export const parseApiToken = (args: Record<string, unknown>): string => {
	if (typeof args.token === 'string') {
		return args.token
	}
	if (API_TOKEN) {
		return API_TOKEN
	}

	throw new Error('missing parameters --token')
}

export const printErrorThenExit = (e: unknown): never => {
	printError(e)
	process.exit(1)
}

export const printError = (e: unknown) => {
	if (e instanceof Error) {
		console.error(e)
	} else {
		console.error(e)
	}
}
