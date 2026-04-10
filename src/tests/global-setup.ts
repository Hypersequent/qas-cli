import type { TestProject } from 'vitest/node'

const { QAS_TEST_URL, QAS_TEST_USERNAME, QAS_TEST_PASSWORD, QAS_DEV_AUTH } = process.env

declare module 'vitest' {
	export interface ProvidedContext {
		sessionToken: string | null
	}
}

async function login(baseURL: string): Promise<string> {
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (QAS_DEV_AUTH) {
		headers['Cookie'] = `_devauth=${QAS_DEV_AUTH}`
	}
	const resp = await fetch(`${baseURL}/api/auth/login`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ email: QAS_TEST_USERNAME, password: QAS_TEST_PASSWORD }),
	})
	if (!resp.ok) {
		throw new Error(`Login failed: ${resp.status} ${resp.statusText}`)
	}
	const data: { token: string } = await resp.json()
	return data.token
}

export default async function setup(project: TestProject) {
	if (!QAS_TEST_URL || !QAS_TEST_USERNAME || !QAS_TEST_PASSWORD) {
		project.provide('sessionToken', null)
		return
	}
	const token = await login(QAS_TEST_URL)
	project.provide('sessionToken', token)
}
