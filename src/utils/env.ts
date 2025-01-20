import { config, DotenvPopulateInput } from 'dotenv'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import chalk from 'chalk'

export const qasEnvFile = '.qaspherecli'
export const qasEnvs = ['QAS_TOKEN', 'QAS_URL']

export function loadEnvs(): void {
	const fileEnvs: DotenvPopulateInput = {}
	let dir = process.cwd()

	for (;;) {
		const envPath = join(dir, qasEnvFile)
		if (existsSync(envPath)) {
			config({ path: envPath, processEnv: fileEnvs })
			break
		}

		const parentDir = dirname(dir)
		if (parentDir === dir) {
			// If the parent directory is the same as the current, we've reached the root
			break
		}

		dir = parentDir
	}

	const missingEnvs = []
	for (const env of qasEnvs) {
		process.env[env] ??= fileEnvs[env]
		if (!process.env[env]) {
			missingEnvs.push(env)
		}
	}

	if (missingEnvs.length > 0) {
		console.log(chalk.red('Missing required environment variables: ') + missingEnvs.join(', '))
		console.log('\nPlease create a .qaspherecli file with the following content:')
		console.log(
			chalk.green(`
QAS_TOKEN=your_token
QAS_URL=http://your-qasphere-instance-url

# Example:
# QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
# QAS_URL=http://tenant1.localhost:5173`)
		)
		console.log('\nOr export them as environment variables:')
		console.log(
			chalk.green(`
export QAS_TOKEN=your_token
export QAS_URL=http://your-qasphere-instance-url`)
		)
		process.exit(1)
	}
}
