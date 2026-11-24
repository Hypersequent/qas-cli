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

export function isInteractive(): boolean {
	return Boolean(process.stdin.isTTY && process.stdout.isTTY) && !process.env.CI
}

/** Asks a yes/no question; an empty answer means yes. */
export async function confirm(question: string): Promise<boolean> {
	return ['', 'y', 'yes'].includes((await prompt(question)).toLowerCase())
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
