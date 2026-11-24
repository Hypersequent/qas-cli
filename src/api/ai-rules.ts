import { z } from 'zod'
import { ResourceId, validateRequest } from './schemas'
import { appendSearchParams, jsonResponse, withJson } from './utils'

export const aiRuleTypes = [
	'system',
	'all',
	'tcase',
	'tcase-single',
	'tcase-bulk',
	'issue',
	'manual',
] as const

export interface AIRule {
	id: string
	name: string
	scope: 'project' | 'global'
	type: (typeof aiRuleTypes)[number]
	enabled: boolean
	prompt: string
	createdBy: number
	createdAt: string
	updatedAt: string
	deletedAt: string | null
}

export const ListAIRulesRequestSchema = z.object({
	types: z.array(z.enum(aiRuleTypes)).optional(),
	enabled: z.boolean().optional(),
})

export type ListAIRulesRequest = z.infer<typeof ListAIRulesRequestSchema>

export const createAIRuleApi = (fetcher: typeof fetch) => {
	fetcher = withJson(fetcher)
	return {
		list: async (projectCode: ResourceId, params?: ListAIRulesRequest) => {
			const validated = params ? validateRequest(params, ListAIRulesRequestSchema) : {}
			return fetcher(
				appendSearchParams(`/api/public/v0/project/${projectCode}/ai-rule`, validated)
			).then((r) => jsonResponse<{ aiRules: AIRule[] }>(r))
		},
	}
}
