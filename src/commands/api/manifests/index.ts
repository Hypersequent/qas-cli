import type { ApiEndpointSpec } from '../types'
import { auditLogSpecs } from './audit-logs'
import { customFieldSpecs } from './custom-fields'
import { fileSpecs } from './files'
import { folderSpecs } from './folders'
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
import { userSpecs } from './users'

export const allSpecs: ApiEndpointSpec[] = [
	...auditLogSpecs,
	...customFieldSpecs,
	...fileSpecs,
	...folderSpecs,
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
	...userSpecs,
]
