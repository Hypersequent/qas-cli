#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { JUnitUploadCommandModule } from '../commands/junit-upload'

yargs(hideBin(process.argv))
	.usage(`$0 <command> [options]`)
	.command(new JUnitUploadCommandModule())
	.demandCommand()
	.help('h')
	.alias('h', 'help')
	.wrap(null)
	.parse()
