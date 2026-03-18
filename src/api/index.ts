import { createAuditLogApi } from './audit-logs'
import { createCustomFieldApi } from './custom-fields'
import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createMilestoneApi } from './milestones'
import { createProjectApi } from './projects'
import { createRequirementApi } from './requirements'
import { createResultApi } from './results'
import { createRunApi } from './runs'
import { createSettingsApi } from './settings'
import { createSharedPreconditionApi } from './shared-preconditions'
import { createSharedStepApi } from './shared-steps'
import { createTagApi } from './tags'
import { createTCaseApi } from './tcases'
import { createTestPlanApi } from './test-plans'
import { createUserApi } from './users'
import { withBaseUrl, withDevAuth, withHeaders, withHttpRetry } from './utils'
import { CLI_VERSION } from '../utils/version'

const getApi = (fetcher: typeof fetch) => {
	return {
		auditLogs: createAuditLogApi(fetcher),
		customFields: createCustomFieldApi(fetcher),
		files: createFileApi(fetcher),
		folders: createFolderApi(fetcher),
		milestones: createMilestoneApi(fetcher),
		projects: createProjectApi(fetcher),
		requirements: createRequirementApi(fetcher),
		results: createResultApi(fetcher),
		runs: createRunApi(fetcher),
		settings: createSettingsApi(fetcher),
		sharedPreconditions: createSharedPreconditionApi(fetcher),
		sharedSteps: createSharedStepApi(fetcher),
		tags: createTagApi(fetcher),
		testCases: createTCaseApi(fetcher),
		testPlans: createTestPlanApi(fetcher),
		users: createUserApi(fetcher),
	}
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, apiKey: string) =>
	getApi(
		withHttpRetry(
			withHeaders(withDevAuth(withBaseUrl(fetch, baseUrl)), {
				Authorization: `ApiKey ${apiKey}`,
				'User-Agent': `qas-cli/${CLI_VERSION}`,
			})
		)
	)
