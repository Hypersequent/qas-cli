import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'

const FALLBACK_VERSION = '0-hpsq-unknown'

function tryReadPackageJson(path: string): string | null {
	try {
		if (existsSync(path)) {
			const content = readFileSync(path, 'utf8')
			const pkg = JSON.parse(content)
			if (pkg.version && typeof pkg.version === 'string') {
				return pkg.version
			}
		}
	} catch {
		// Silently fail
	}
	return null
}

export function getVersion(): string {
	try {
		const __filename = fileURLToPath(import.meta.url)
		let currentDir = dirname(__filename)

		for (let i = 0; i < 5; i++) {
			const packagePath = join(currentDir, 'package.json')
			const version = tryReadPackageJson(packagePath)
			if (version) return version

			const parentDir = dirname(currentDir)
			if (parentDir === currentDir) break // Reached root
			currentDir = parentDir
		}
	} catch {
		// fileURLToPath might fail in some environments
	}

	return FALLBACK_VERSION
}
