import { config, DotenvPopulateInput } from 'dotenv';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import chalk from 'chalk';

export const qasEnvFile = '.qaspherecli'
export const qasEnvs = ['QAS_TOKEN']

export function loadEnvs(): void {
	const fileEnvs : DotenvPopulateInput = {}
	let dir = process.cwd();

	for (;;) {
		const envPath = join(dir, qasEnvFile);
		if (existsSync(envPath)) {
			config({ path: envPath, processEnv: fileEnvs });
			break;
		}

		const parentDir = dirname(dir);
		if (parentDir === dir) {
			// If the parent directory is the same as the current, we've reached the root
			break;
		}

		dir = parentDir;
	}

	const missingEnvs = []
	for (const env of qasEnvs) {
		process.env[env] ??= fileEnvs[env]
		if (!process.env[env]) {
			missingEnvs.push(env)
		}
	}

	if (missingEnvs.length > 0) {
		console.log(`${chalk.red('Missing inputs')}: ${missingEnvs.join(', ')}
Please provide these as environment variables or declare them in .qaspherecli file in the current directory or one of its parents`)
		process.exit(1)
	}
}
