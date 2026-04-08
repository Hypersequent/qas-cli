import { createInterface } from 'node:readline'

export function ensureInteractive(): void {
	if (!process.stdin.isTTY) {
		console.error(
			'Error: This command requires an interactive terminal.\n' +
				'Use environment variables (QAS_TOKEN, QAS_URL) for non-interactive environments.'
		)
		process.exit(1)
	}
}

export function prompt(question: string): Promise<string> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	return new Promise((resolve) => {
		rl.question(question, (answer) => {
			rl.close()
			resolve(answer.trim())
		})
	})
}

export function promptHidden(question: string): Promise<string> {
	return new Promise((resolve) => {
		process.stdout.write(question)
		const chars: string[] = []

		process.stdin.setRawMode(true)
		process.stdin.resume()
		process.stdin.setEncoding('utf-8')

		const onData = (char: string) => {
			// Ctrl+C
			if (char === '\u0003') {
				process.stdin.setRawMode(false)
				process.stdin.pause()
				process.stdin.removeListener('data', onData)
				process.stdout.write('\n')
				process.exit(0)
			}

			// Enter
			if (char === '\r' || char === '\n') {
				process.stdin.setRawMode(false)
				process.stdin.pause()
				process.stdin.removeListener('data', onData)
				process.stdout.write('\n')
				resolve(chars.join(''))
				return
			}

			// Backspace
			if (char === '\u007F' || char === '\b') {
				chars.pop()
				return
			}

			chars.push(char)
		}

		process.stdin.on('data', onData)
	})
}
