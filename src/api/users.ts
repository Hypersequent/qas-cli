import { jsonResponse, withJson } from './utils'

export interface User {
	id: number
	email: string
	name: string
	role: string
}

export interface MeUser {
	id: number
	email: string
	name: string
	avatar: string | null
	role: string
}

export const createUserApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: () =>
			fetcher(`/api/public/v0/users`)
				.then((r) => jsonResponse<{ users: User[] }>(r))
				.then((r) => r.users),
		me: () =>
			fetcher(`/api/public/v0/users/me`)
				.then((r) => jsonResponse<{ user: MeUser }>(r))
				.then((r) => r.user),
	}
}
