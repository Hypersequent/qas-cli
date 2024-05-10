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
