import { jsonResponse, withJson } from './utils'

export interface User {
	id: number
	email: string
	name: string
	role: string
}

export const createUserApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: () =>
			fetcher(`/api/public/v0/users`)
				.then((r) => jsonResponse<{ users: User[] }>(r))
				.then((r) => r.users),
	}
}
