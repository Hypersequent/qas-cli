import { z } from 'zod'
import { aiRuleTypes } from '../../../api/ai-rules'
import { printJson, apiDocsEpilog } from '../utils'
import { commonHelp, projectCodeParam, splitList } from './utils'
import type { ApiEndpointSpec } from '../types'

const help = {
	...commonHelp,
	types: `Comma-separated rule types to list: ${aiRuleTypes.join(', ')}. The rules applied when writing test cases are system, all and tcase.`,
	enabled: 'List only enabled (true) or disabled (false) rules.',
	list: {
		describe:
			'List the AI rules that apply in a project: its own and the global rules enabled for it.',
		epilog: apiDocsEpilog('ai_rules', 'list-ai-rules'),
		examples: [
			{ usage: '$0 api ai-rules list --project-code PRJ', description: 'List AI rules' },
			{
				usage: '$0 api ai-rules list --project-code PRJ --types system,all,tcase --enabled',
				description: 'List the rules applied when writing test cases',
			},
		],
	},
} as const

const typesSchema = z.string().refine(
	(value) =>
		value
			.split(',')
			.map((item) => item.trim())
			.every((item) => (aiRuleTypes as readonly string[]).includes(item)),
	`must be comma-separated values of ${aiRuleTypes.join(', ')}`
)

const list: ApiEndpointSpec = {
	id: 'ai-rules.list',
	commandPath: ['ai-rules', 'list'],
	describe: help.list.describe,
	bodyMode: 'none',
	pathParams: [projectCodeParam],
	queryOptions: [
		{ name: 'types', type: 'string', describe: help.types, schema: typesSchema },
		{ name: 'enabled', type: 'boolean', describe: help.enabled },
	],
	transformQuery: (query) => ({ ...query, types: splitList(query.types) }),
	epilog: help.list.epilog,
	examples: help.list.examples,
	execute: async (api, { pathParams, query }) => {
		printJson(
			await api.aiRules.list(
				pathParams['project-code'],
				query as Parameters<typeof api.aiRules.list>[1]
			)
		)
	},
}

export const aiRuleSpecs: ApiEndpointSpec[] = [list]
