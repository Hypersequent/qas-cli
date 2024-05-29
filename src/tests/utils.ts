import { SetupServerApi } from 'msw/node'

export const countMockedCalls = (
	server: SetupServerApi,
	url: string | RegExp | ((req: Request) => boolean)
) => {
	let count = 0
	const checkEvent = (e: { request: Request }) => {
		if (typeof url === 'string') {
			return url === e.request.url
		}
		if (url instanceof RegExp) {
			return url.test(e.request.url)
		}
		return url(e.request)
	}
	server.events.on('response:mocked', (e) => {
		if (checkEvent(e)) {
			count++
		}
	})
	return () => count
}
