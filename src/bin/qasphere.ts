#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from '../commands/main'
import { refreshAgentSkill } from '../commands/skill'
import { validateNodeVersion } from '../utils/misc'
import { REQUIRED_NODE_VERSION } from '../utils/config'
import chalk from 'chalk'

if (!validateNodeVersion()) {
	console.warn(
		chalk.yellow(
			`Node.js version must be v${REQUIRED_NODE_VERSION} or higher. Current version is ${process.version}. Some features may not work correctly.`
		)
	)
}

const args = hideBin(process.argv)

// Here rather than in run() so tests driving run() never touch the real home directory. Tab
// completion runs the CLI too, and a notice there would land in the middle of the shell prompt.
if (args[0] !== 'skill' && args[0] !== '--get-yargs-completions') {
	refreshAgentSkill()
}

run(args)
