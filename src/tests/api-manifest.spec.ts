import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test } from 'vitest'

import { apiEndpointSpecs } from '../commands/api/manifest'

const docsRoot = join(process.cwd(), '..', 'qasphere-docs', 'docs', 'api', 'endpoints')

describe('API endpoint manifest', () => {
	test('exposes all planned CLI commands', () => {
		expect(apiEndpointSpecs.map((spec) => spec.commandPath.join(' '))).toEqual([
			'projects list',
			'projects get',
			'projects create',
			'folders list',
			'folders upsert',
			'milestones list',
			'milestones create',
			'plans create',
			'requirements list',
			'results add',
			'results add-batch',
			'runs list',
			'runs create',
			'runs clone',
			'runs close',
			'runs list-tcases',
			'runs get-tcase',
			'settings statuses get',
			'settings statuses update',
			'shared-preconditions list',
			'shared-preconditions get',
			'shared-steps list',
			'shared-steps get',
			'tags list',
			'testcases list',
			'testcases get',
			'testcases count',
			'testcases create',
			'testcases update',
			'custom-fields list',
			'files upload',
			'users list',
			'audit-logs list',
		])
	})

	test('references the intended schemas or explicit local adapters', () => {
		expect(
			Object.fromEntries(
				apiEndpointSpecs.map((spec) => [
					spec.id,
					{
						query: spec.requestSchemaLinks?.query ?? null,
						body: spec.requestSchemaLinks?.body ?? null,
						response: spec.requestSchemaLinks?.response ?? null,
					},
				])
			)
		).toEqual({
			'projects.list': { query: null, body: null, response: 'GetPublicProjectsResponseSchema' },
			'projects.get': { query: null, body: null, response: 'PublicProjectSchema' },
			'projects.create': {
				query: null,
				body: 'CreateProjectRequestSchema',
				response: 'IDResponseSchema',
			},
			'folders.list': {
				query: 'GetPublicPaginatedFolderRequestSchema',
				body: null,
				response: 'GetPaginatedFolderResponseSchema',
			},
			'folders.upsert': {
				query: null,
				body: 'BulkUpsertFoldersRequestSchema',
				response: 'BulkUpsertFoldersResponseSchema',
			},
			'milestones.list': {
				query: 'GetMilestonesRequestSchema',
				body: null,
				response: 'GetPublicApiMilestonesResponseSchema',
			},
			'milestones.create': {
				query: null,
				body: 'CreateMilestonePublicRequestSchema',
				response: 'IDResponseSchema',
			},
			'plans.create': {
				query: null,
				body: 'CreatePlanRequestSchema',
				response: 'IDResponseSchema',
			},
			'requirements.list': {
				query: 'GetRequirementsRequestSchema',
				body: null,
				response: 'GetRequirementsResponseSchema',
			},
			'results.add': {
				query: null,
				body: 'CreateResultRequestSchema',
				response: 'IDResponseSchema',
			},
			'results.add-batch': {
				query: null,
				body: 'CreateResultsRequestSchema',
				response: 'IDsResponseSchema',
			},
			'runs.list': {
				query: 'ListRunsRequestSchema',
				body: null,
				response: 'GetRunsResponseSchema',
			},
			'runs.create': {
				query: null,
				body: 'CreateRunRequestSchema',
				response: 'IDResponseSchema',
			},
			'runs.clone': {
				query: null,
				body: 'CloneRunRequestSchema',
				response: 'IDResponseSchema',
			},
			'runs.close': { query: null, body: null, response: 'MessageResponseSchema' },
			'runs.list-tcases': {
				query: 'ListRunTCasesRequestSchema',
				body: null,
				response: 'GetRunTCasesResponseSchema',
			},
			'runs.get-tcase': { query: null, body: null, response: 'RunTCaseSchema' },
			'settings.statuses.get': {
				query: null,
				body: null,
				response: 'GetStatusesResponseSchema',
			},
			'settings.statuses.update': {
				query: null,
				body: 'UpdateStatusesRequestSchema',
				response: 'MessageResponseSchema',
			},
			'shared-preconditions.list': {
				query: 'GetSharedPreconditionsRequestSchema',
				body: null,
				response: 'PreconditionSchema[]',
			},
			'shared-preconditions.get': {
				query: null,
				body: null,
				response: 'PreconditionSchema',
			},
			'shared-steps.list': {
				query: 'GetSharedStepsRequestSchema',
				body: null,
				response: 'GetSharedStepsResponseSchema',
			},
			'shared-steps.get': { query: null, body: null, response: 'StepSchema' },
			'tags.list': { query: 'GetTagsRequestSchema', body: null, response: 'GetTagsResponseSchema' },
			'testcases.list': {
				query: 'GetPaginatedTCaseRequestSchema',
				body: null,
				response: 'GetPaginatedTCaseResponseSchema',
			},
			'testcases.get': { query: null, body: null, response: 'FullTCaseSchema' },
			'testcases.count': {
				query: 'GetTCasesCountRequestSchema',
				body: null,
				response: 'GetTCasesCountResponseSchema',
			},
			'testcases.create': {
				query: null,
				body: 'CreateTCaseRequestSchema',
				response: 'CreateTCaseResponseSchema',
			},
			'testcases.update': {
				query: null,
				body: 'UpdateTCaseRequestSchema',
				response: 'MessageResponseSchema',
			},
			'custom-fields.list': {
				query: null,
				body: null,
				response: 'GetCustomFieldsResponseSchema',
			},
			'files.upload': { query: null, body: null, response: 'UploadFileResponseSchema' },
			'users.list': { query: null, body: null, response: 'GetPublicUsersListResponseSchema' },
			'audit-logs.list': {
				query: 'GetPublicAuditLogsRequestSchema',
				body: null,
				response: 'GetPublicAuditLogsResponseSchema',
			},
		})
	})

	test('matches documented public routes when the docs repository is available', () => {
		if (!existsSync(docsRoot)) {
			return
		}

		const routeRegex =
			/<RouteHighlighter[\s\S]*?method='([A-Z]+)'[\s\S]*?path='([^']+)'[\s\S]*?\/>/g
		const docRoutes = new Set<string>()
		for (const fileName of [
			'audit_logs.mdx',
			'folders.mdx',
			'milestone.mdx',
			'plan.mdx',
			'projects.mdx',
			'requirements.mdx',
			'result.mdx',
			'run.mdx',
			'settings.mdx',
			'shared_preconditions.mdx',
			'shared_steps.mdx',
			'tag.mdx',
			'tcases.mdx',
			'tcases_custom_fields.mdx',
			'upload_file.mdx',
			'users.mdx',
		]) {
			const fileText = readFileSync(join(docsRoot, fileName), 'utf8')
			for (const match of fileText.matchAll(routeRegex)) {
				docRoutes.add(`${match[1]} ${match[2].replace(/\{[^}]+\}/g, '{}')}`)
			}
		}

		const manifestRoutes = new Set(
			apiEndpointSpecs.map(
				(spec) => `${spec.method} ${spec.pathTemplate.replace(/\{[^}]+\}/g, '{}')}`
			)
		)

		expect(manifestRoutes).toEqual(docRoutes)
	})
})
