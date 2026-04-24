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
