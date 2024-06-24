#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from '../commands/main'
import { printErrorThenExit, validateNodeVersion } from '../utils/misc'
import { REQUIRED_NODE_VERSION } from '../utils/config'

if (!validateNodeVersion()) {
	printErrorThenExit(
		`NodeJS version must be v${REQUIRED_NODE_VERSION} or higher. Current version ${process.version}`
	)
}

run(hideBin(process.argv))
