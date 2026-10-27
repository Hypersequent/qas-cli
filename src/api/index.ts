import { createAIRuleApi } from './ai-rules'
import { createAuditLogApi } from './audit-logs'
import { createConfigurationApi } from './configurations'
import { createCustomFieldApi } from './custom-fields'
import { createFileApi } from './file'
import { createFolderApi } from './folders'
import { createIntegrationApi } from './integrations'
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
import { createTrashApi } from './trash'
import { createUserApi } from './users'
import {
	withFetchMiddlewares,
	withBaseUrl,
	withAuth,
	withDevAuth,
	withUserAgent,
	withHttpRetry,
} from './utils'
import { CLI_VERSION } from '../utils/version'

const getApi = (fetcher: typeof fetch) => {
	return {
		aiRules: createAIRuleApi(fetcher),
		auditLogs: createAuditLogApi(fetcher),
		configurations: createConfigurationApi(fetcher),
		customFields: createCustomFieldApi(fetcher),
		files: createFileApi(fetcher),
		folders: createFolderApi(fetcher),
		integrations: createIntegrationApi(fetcher),
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
		trash: createTrashApi(fetcher),
		users: createUserApi(fetcher),
	}
}

export type Api = ReturnType<typeof getApi>

export const createApi = (baseUrl: string, token: string) =>
	getApi(
		withFetchMiddlewares(
			fetch,
			withBaseUrl(baseUrl),
			withDevAuth,
			withUserAgent(CLI_VERSION),
			withAuth(token),
			withHttpRetry
		)
	)
