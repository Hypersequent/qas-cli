import type { ApiEndpointSpec } from '../types'
import { aiRuleSpecs } from './ai-rules'
import { auditLogSpecs } from './audit-logs'
import { configurationSpecs } from './configurations'
import { customFieldSpecs } from './custom-fields'
import { fileSpecs } from './files'
import { folderSpecs } from './folders'
import { integrationSpecs } from './integrations'
import { milestoneSpecs } from './milestones'
import { projectSpecs } from './projects'
import { requirementSpecs } from './requirements'
import { resultSpecs } from './results'
import { runSpecs } from './runs'
import { settingSpecs } from './settings'
import { sharedPreconditionSpecs } from './shared-preconditions'
import { sharedStepSpecs } from './shared-steps'
import { tagSpecs } from './tags'
import { testCaseSpecs } from './test-cases'
import { testPlanSpecs } from './test-plans'
import { trashSpecs } from './trash'
import { userSpecs } from './users'

export const allSpecs: ApiEndpointSpec[] = [
	...aiRuleSpecs,
	...auditLogSpecs,
	...configurationSpecs,
	...customFieldSpecs,
	...fileSpecs,
	...folderSpecs,
	...integrationSpecs,
	...milestoneSpecs,
	...projectSpecs,
	...requirementSpecs,
	...resultSpecs,
	...runSpecs,
	...settingSpecs,
	...sharedPreconditionSpecs,
	...sharedStepSpecs,
	...tagSpecs,
	...testCaseSpecs,
	...testPlanSpecs,
	...trashSpecs,
	...userSpecs,
]
