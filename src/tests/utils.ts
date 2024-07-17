import { SetupServerApi } from 'msw/node'

export const countMockedApiCalls = (
	server: SetupServerApi,
	url: string | RegExp | ((req: Request) => boolean)
) => {
	let count = 0
	const checkEvent = (e: { request: Request }) => {
		const requestUrl = new URL(e.request.url)
		if (typeof url === 'string') {
			return url === requestUrl.pathname
		}
		if (url instanceof RegExp) {
			return url.test(requestUrl.pathname)
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
