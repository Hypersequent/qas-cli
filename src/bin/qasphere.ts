#!/usr/bin/env node

import { hideBin } from 'yargs/helpers'
import { run } from '../commands/main'

run(hideBin(process.argv))
