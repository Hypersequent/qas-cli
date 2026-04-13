import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		globalSetup: './src/tests/global-setup.ts',
		tags: [{ name: 'live' }, { name: 'mocked' }],
	},
})
