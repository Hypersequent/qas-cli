#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from '../commands/main'
import { validateNodeVersion } from '../utils/misc'
import { REQUIRED_NODE_VERSION } from '../utils/config'

if (!validateNodeVersion()) {
	console.warn(
		`Node.js version must be v${REQUIRED_NODE_VERSION} or higher. Current version is ${process.version}. Some features may not work correctly.`
	)
}

run(hideBin(process.argv))
