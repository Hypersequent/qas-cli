#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from '../commands/main'
import { validateNodeVersion } from '../utils/misc'
import { REQUIRED_NODE_VERSION } from '../utils/config'
import { loadEnvs } from '../utils/env'
import chalk from 'chalk'

if (!validateNodeVersion()) {
	console.warn(
		chalk.yellow(
			`Node.js version must be v${REQUIRED_NODE_VERSION} or higher. Current version is ${process.version}. Some features may not work correctly.`
		)
	)
}

loadEnvs()
run(hideBin(process.argv))
