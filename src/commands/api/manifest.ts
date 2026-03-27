import { z } from 'zod'

import {
	BulkUpsertFoldersRequestSchema,
	BulkUpsertFoldersResponseSchema,
	CreateMilestonePublicRequestSchema,
	CreatePlanRequestSchema,
	CreateProjectRequestSchema,
	CreateResultRequestSchema,
	CreateResultsRequestSchema,
	CreateRunRequestSchema,
	CreateTCaseRequestSchema,
	CreateTCaseResponseSchema,
	CloneRunRequestSchema,
	FullTCaseSchema,
	GetCustomFieldsResponseSchema,
	GetMilestonesRequestSchema,
	GetPaginatedFolderResponseSchema,
	GetPaginatedTCaseRequestSchema,
	GetPaginatedTCaseResponseSchema,
	GetPublicApiMilestonesResponseSchema,
	GetPublicPaginatedFolderRequestSchema,
	GetPublicAuditLogsRequestSchema,
	GetPublicAuditLogsResponseSchema,
	GetPublicProjectsResponseSchema,
	GetPublicUsersListResponseSchema,
	GetRequirementsRequestSchema,
	GetRequirementsResponseSchema,
	GetRunsResponseSchema,
	GetRunTCasesResponseSchema,
	GetSharedPreconditionsRequestSchema,
	GetSharedStepsRequestSchema,
	GetSharedStepsResponseSchema,
	GetStatusesResponseSchema,
	GetTagsRequestSchema,
	GetTagsResponseSchema,
	GetTCasesCountRequestSchema,
	GetTCasesCountResponseSchema,
	IDResponseSchema,
	IDsResponseSchema,
	ListRunTCasesRequestSchema,
	ListRunsRequestSchema,
	MessageResponseSchema,
	PreconditionSchema,
	PublicProjectSchema,
	RunTCaseSchema,
	StepSchema,
	UploadFileResponseSchema,
	UpdateStatusesRequestSchema,
	UpdateTCaseRequestSchema,
} from './sharedSchemas'
import { ApiEndpointSpec, ApiOptionSpec } from './types'

const priorityChoices = ['low', 'medium', 'high'] as const
const sortOrderChoices = ['asc', 'desc'] as const

const pathParam = (
	name: string,
	describe: string,
	type: 'string' | 'integer'
): ApiEndpointSpec['pathParams'][number] => ({
	name,
	describe,
	type,
})

const option = (
	name: string,
	describe: string,
	type: ApiOptionSpec['type'],
	config?: Partial<ApiOptionSpec>
): ApiOptionSpec => ({
	name,
	describe,
	type,
	...config,
})

const asRecord = (value: unknown) => {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return {}
	}
	return value as Record<string, unknown>
}

const withNulls = (value: unknown, keys: string[]) => {
	const next = { ...asRecord(value) }
	for (const key of keys) {
		if (!(key in next)) {
			next[key] = null
		}
	}
	return next
}

const normalizeResultLinks = (value: unknown) => {
	const input = asRecord(value)
	return withNulls(input, ['links', 'timeTaken'])
}

const normalizeResultBatch = (value: unknown) => {
	const input = withNulls(value, ['items'])
	if (!Array.isArray(input.items)) {
		return input
	}
	return {
		...input,
		items: input.items.map((item) => normalizeResultLinks(item)),
	}
}

const normalizeCreateProjectBody = (value: unknown) =>
	withNulls(value, ['links', 'overviewTitle', 'overviewDescription'])

const normalizeCreateRunBody = (value: unknown) =>
	withNulls(value, [
		'description',
		'milestoneId',
		'configurationId',
		'assignmentId',
		'links',
		'integrationLink',
	])

const normalizeCloneRunBody = (value: unknown) => {
	const input = asRecord(value)
	if (!('description' in input)) {
		input.description = ''
	}
	return input
}

const normalizeCreatePlanBody = (value: unknown) => {
	const input = asRecord(value)
	if (!('description' in input)) {
		input.description = ''
	}
	return input
}

const normalizeTCaseSteps = (steps: unknown) => {
	if (!Array.isArray(steps)) {
		return steps
	}
	return steps.map((step) => {
		const next = asRecord(step)
		if (!('description' in next)) {
			next.description = ''
		}
		if (!('expected' in next)) {
			next.expected = ''
		}
		return next
	})
}

const normalizeCreateTCaseBody = (value: unknown) => {
	const input = withNulls(value, [
		'pos',
		'files',
		'requirements',
		'links',
		'tags',
		'steps',
		'customFields',
		'parameterValues',
	])
	if (!('isDraft' in input)) {
		input.isDraft = false
	}
	input.steps = normalizeTCaseSteps(input.steps)
	return input
}

const normalizeUpdateTCaseBody = (value: unknown) => {
	const input = withNulls(value, ['requirements', 'links', 'tags', 'steps', 'files'])
	if ('steps' in input) {
		input.steps = normalizeTCaseSteps(input.steps)
	}
	const precondition = asRecord(input.precondition)
	if ('id' in precondition && !('sharedPreconditionId' in precondition)) {
		precondition.sharedPreconditionId = precondition.id
		delete precondition.id
		input.precondition = precondition
	}
	return input
}

const normalizeNullableQuery = (keys: string[]) => (value: Record<string, unknown>) =>
	withNulls(value, keys)

const SharedPreconditionsListResponseSchema: z.ZodTypeAny = z.array(
	PreconditionSchema as z.ZodTypeAny
)

const projectParam = pathParam('project', 'Project code or ID', 'string')
const runParam = pathParam('run', 'Run ID', 'integer')
const tcaseParam = pathParam('tcase', 'Test case ID, sequence, or legacy ID', 'string')
const numericIdParam = (name: string, describe: string) => pathParam(name, describe, 'integer')

const commonSortAndIncludeOptions = (
	sortFields: readonly string[],
	includeChoices: readonly string[]
): ApiOptionSpec[] => [
	option('sortField', 'Sort field', 'string', { choices: sortFields }),
	option('sortOrder', 'Sort direction', 'string', { choices: sortOrderChoices }),
	option('include', 'Additional response fields to include', 'string', {
		array: true,
		choices: includeChoices,
	}),
]

const testCaseFilterOptions: ApiOptionSpec[] = [
	option('page', 'Page number', 'integer'),
	option('limit', 'Maximum number of test cases to return', 'integer'),
	option('sortField', 'Sort field', 'string', {
		choices: [
			'id',
			'seq',
			'folder_id',
			'author_id',
			'pos',
			'title',
			'priority',
			'created_at',
			'updated_at',
			'legacy_id',
		],
	}),
	option('sortOrder', 'Sort direction', 'string', { choices: sortOrderChoices }),
	option('types', 'Filter by test case type', 'string', {
		array: true,
		choices: ['standalone', 'template', 'filled'],
	}),
	option('search', 'Filter by title', 'string'),
	option('folders', 'Filter by folder ID', 'integer', { array: true }),
	option('tags', 'Filter by tag ID', 'integer', { array: true }),
	option('priorities', 'Filter by priority', 'string', { array: true, choices: priorityChoices }),
	option('draft', 'Filter by draft status', 'boolean'),
	option('templateTCaseIds', 'Filter by template test case ID', 'string', { array: true }),
	option('requirementIds', 'Filter by requirement ID', 'string', { array: true }),
	option('include', 'Additional response fields to include', 'string', {
		array: true,
		choices: [
			'precondition',
			'steps',
			'tags',
			'project',
			'folder',
			'path',
			'requirements',
			'customFields',
			'parameterValues',
		],
	}),
]

const testCaseCountOptions: ApiOptionSpec[] = [
	option('folders', 'Filter by folder ID', 'integer', { array: true }),
	option('recursive', 'Include child folders', 'boolean'),
	option('tags', 'Filter by tag ID', 'integer', { array: true }),
	option('priorities', 'Filter by priority', 'string', { array: true, choices: priorityChoices }),
	option('draft', 'Filter by draft status', 'boolean'),
]

export const apiEndpointSpecs: ApiEndpointSpec[] = [
	{
		id: 'projects.list',
		commandPath: ['projects', 'list'],
		describe: 'List visible projects',
		method: 'GET',
		pathTemplate: '/api/public/v0/project',
		pathParams: [],
		bodyMode: 'none',
		responseSchema: GetPublicProjectsResponseSchema,
		requestSchemaLinks: { response: 'GetPublicProjectsResponseSchema' },
	},
	{
		id: 'projects.get',
		commandPath: ['projects', 'get'],
		describe: 'Get one project by code or ID',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}',
		pathParams: [projectParam],
		bodyMode: 'none',
		responseSchema: PublicProjectSchema,
		requestSchemaLinks: { response: 'PublicProjectSchema' },
	},
	{
		id: 'projects.create',
		commandPath: ['projects', 'create'],
		describe: 'Create a project',
		method: 'POST',
		pathTemplate: '/api/public/v0/project',
		pathParams: [],
		bodyMode: 'json',
		bodySchema: CreateProjectRequestSchema,
		bodyAdapter: normalizeCreateProjectBody,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CreateProjectRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'folders.list',
		commandPath: ['folders', 'list'],
		describe: 'List project folders',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/tcase/folders',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: [
			option('page', 'Page number', 'integer'),
			option('limit', 'Maximum number of folders to return', 'integer'),
			option('sortField', 'Sort field', 'string', {
				choices: ['id', 'project_id', 'title', 'pos', 'parent_id', 'created_at', 'updated_at'],
			}),
			option('sortOrder', 'Sort direction', 'string', { choices: sortOrderChoices }),
		],
		querySchema: GetPublicPaginatedFolderRequestSchema,
		responseSchema: GetPaginatedFolderResponseSchema,
		requestSchemaLinks: {
			query: 'GetPublicPaginatedFolderRequestSchema',
			response: 'GetPaginatedFolderResponseSchema',
		},
	},
	{
		id: 'folders.upsert',
		commandPath: ['folders', 'upsert'],
		describe: 'Bulk upsert project folders',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/tcase/folder/bulk',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: BulkUpsertFoldersRequestSchema,
		bodyAdapter: (value) => withNulls(value, ['folders']),
		responseSchema: BulkUpsertFoldersResponseSchema,
		requestSchemaLinks: {
			body: 'BulkUpsertFoldersRequestSchema',
			response: 'BulkUpsertFoldersResponseSchema',
		},
	},
	{
		id: 'milestones.list',
		commandPath: ['milestones', 'list'],
		describe: 'List project milestones',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/milestone',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: [option('archived', 'Filter by archived status', 'boolean')],
		querySchema: GetMilestonesRequestSchema,
		queryAdapter: normalizeNullableQuery(['archived']),
		responseSchema: GetPublicApiMilestonesResponseSchema,
		requestSchemaLinks: {
			query: 'GetMilestonesRequestSchema',
			response: 'GetPublicApiMilestonesResponseSchema',
		},
	},
	{
		id: 'milestones.create',
		commandPath: ['milestones', 'create'],
		describe: 'Create a milestone',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/milestone',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: CreateMilestonePublicRequestSchema,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CreateMilestonePublicRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'plans.create',
		commandPath: ['plans', 'create'],
		describe: 'Create a test plan',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/plan',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: CreatePlanRequestSchema,
		bodyAdapter: normalizeCreatePlanBody,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CreatePlanRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'requirements.list',
		commandPath: ['requirements', 'list'],
		describe: 'List project requirements',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/requirement',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: commonSortAndIncludeOptions(['created_at', 'text'], ['tcaseCount']),
		querySchema: GetRequirementsRequestSchema,
		responseSchema: GetRequirementsResponseSchema,
		requestSchemaLinks: {
			query: 'GetRequirementsRequestSchema',
			response: 'GetRequirementsResponseSchema',
		},
	},
	{
		id: 'results.add',
		commandPath: ['results', 'add'],
		describe: 'Add a result to one run test case',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/run/{run}/tcase/{tcase}/result',
		pathParams: [projectParam, runParam, tcaseParam],
		bodyMode: 'json',
		bodySchema: CreateResultRequestSchema,
		bodyAdapter: normalizeResultLinks,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CreateResultRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'results.add-batch',
		commandPath: ['results', 'add-batch'],
		describe: 'Add multiple results to a run',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/run/{run}/result/batch',
		pathParams: [projectParam, runParam],
		bodyMode: 'json',
		bodySchema: CreateResultsRequestSchema,
		bodyAdapter: normalizeResultBatch,
		responseSchema: IDsResponseSchema,
		requestSchemaLinks: {
			body: 'CreateResultsRequestSchema',
			response: 'IDsResponseSchema',
		},
	},
	{
		id: 'runs.list',
		commandPath: ['runs', 'list'],
		describe: 'List project runs',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/run',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: [
			option('closed', 'Filter by closed status', 'boolean'),
			option('milestoneIds', 'Filter by milestone ID', 'integer', { array: true }),
			option('limit', 'Maximum number of runs to return', 'integer'),
		],
		querySchema: ListRunsRequestSchema,
		queryAdapter: normalizeNullableQuery(['limit', 'closed', 'milestoneIds']),
		responseSchema: GetRunsResponseSchema,
		requestSchemaLinks: {
			query: 'ListRunsRequestSchema',
			response: 'GetRunsResponseSchema',
		},
	},
	{
		id: 'runs.create',
		commandPath: ['runs', 'create'],
		describe: 'Create a run',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/run',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: CreateRunRequestSchema,
		bodyAdapter: normalizeCreateRunBody,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CreateRunRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'runs.clone',
		commandPath: ['runs', 'clone'],
		describe: 'Clone an existing run',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/run/clone',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: CloneRunRequestSchema,
		bodyAdapter: normalizeCloneRunBody,
		responseSchema: IDResponseSchema,
		requestSchemaLinks: {
			body: 'CloneRunRequestSchema',
			response: 'IDResponseSchema',
		},
	},
	{
		id: 'runs.close',
		commandPath: ['runs', 'close'],
		describe: 'Close a run',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/run/{run}/close',
		pathParams: [projectParam, runParam],
		bodyMode: 'none',
		responseSchema: MessageResponseSchema.optional(),
		requestSchemaLinks: { response: 'MessageResponseSchema' },
	},
	{
		id: 'runs.list-tcases',
		commandPath: ['runs', 'list-tcases'],
		describe: 'List run test cases',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/run/{run}/tcase',
		pathParams: [projectParam, runParam],
		bodyMode: 'none',
		queryOptions: [
			option('search', 'Filter by title', 'string'),
			option('tags', 'Filter by tag ID', 'integer', { array: true }),
			option('priorities', 'Filter by priority', 'string', {
				array: true,
				choices: priorityChoices,
			}),
			option('include', 'Additional response fields to include', 'string', {
				array: true,
				choices: ['folder'],
			}),
		],
		supportsCustomFieldFilters: true,
		querySchema: ListRunTCasesRequestSchema,
		queryAdapter: normalizeNullableQuery([
			'tags',
			'tagsFilterOp',
			'priorities',
			'search',
			'customFields',
			'include',
		]),
		responseSchema: GetRunTCasesResponseSchema,
		requestSchemaLinks: {
			query: 'ListRunTCasesRequestSchema',
			response: 'GetRunTCasesResponseSchema',
		},
	},
	{
		id: 'runs.get-tcase',
		commandPath: ['runs', 'get-tcase'],
		describe: 'Get one run test case',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/run/{run}/tcase/{tcase}',
		pathParams: [projectParam, runParam, tcaseParam],
		bodyMode: 'none',
		responseSchema: RunTCaseSchema,
		requestSchemaLinks: { response: 'RunTCaseSchema' },
	},
	{
		id: 'settings.statuses.get',
		commandPath: ['settings', 'statuses', 'get'],
		describe: 'Get result status configuration',
		method: 'GET',
		pathTemplate: '/api/public/v0/settings/preferences/status',
		pathParams: [],
		bodyMode: 'none',
		responseSchema: GetStatusesResponseSchema,
		requestSchemaLinks: { response: 'GetStatusesResponseSchema' },
	},
	{
		id: 'settings.statuses.update',
		commandPath: ['settings', 'statuses', 'update'],
		describe: 'Update custom statuses',
		method: 'POST',
		pathTemplate: '/api/public/v0/settings/preferences/status',
		pathParams: [],
		bodyMode: 'json',
		bodySchema: UpdateStatusesRequestSchema,
		responseSchema: MessageResponseSchema,
		requestSchemaLinks: {
			body: 'UpdateStatusesRequestSchema',
			response: 'MessageResponseSchema',
		},
	},
	{
		id: 'shared-preconditions.list',
		commandPath: ['shared-preconditions', 'list'],
		describe: 'List shared preconditions',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/shared-precondition',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: commonSortAndIncludeOptions(['created_at', 'title'], ['tcaseCount']),
		querySchema: GetSharedPreconditionsRequestSchema,
		responseSchema: SharedPreconditionsListResponseSchema,
		requestSchemaLinks: {
			query: 'GetSharedPreconditionsRequestSchema',
			response: 'PreconditionSchema[]',
		},
	},
	{
		id: 'shared-preconditions.get',
		commandPath: ['shared-preconditions', 'get'],
		describe: 'Get one shared precondition',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/shared-precondition/{id}',
		pathParams: [projectParam, numericIdParam('id', 'Shared precondition ID')],
		bodyMode: 'none',
		responseSchema: PreconditionSchema,
		requestSchemaLinks: { response: 'PreconditionSchema' },
	},
	{
		id: 'shared-steps.list',
		commandPath: ['shared-steps', 'list'],
		describe: 'List shared steps',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/shared-step',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: commonSortAndIncludeOptions(['created_at', 'title'], ['tcaseCount']),
		querySchema: GetSharedStepsRequestSchema,
		responseSchema: GetSharedStepsResponseSchema,
		requestSchemaLinks: {
			query: 'GetSharedStepsRequestSchema',
			response: 'GetSharedStepsResponseSchema',
		},
	},
	{
		id: 'shared-steps.get',
		commandPath: ['shared-steps', 'get'],
		describe: 'Get one shared step',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/shared-step/{id}',
		pathParams: [projectParam, numericIdParam('id', 'Shared step ID')],
		bodyMode: 'none',
		responseSchema: StepSchema,
		requestSchemaLinks: { response: 'StepSchema' },
	},
	{
		id: 'tags.list',
		commandPath: ['tags', 'list'],
		describe: 'List project tags',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/tag',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: commonSortAndIncludeOptions(['created_at', 'title'], ['tcaseCount']),
		querySchema: GetTagsRequestSchema,
		responseSchema: GetTagsResponseSchema,
		requestSchemaLinks: {
			query: 'GetTagsRequestSchema',
			response: 'GetTagsResponseSchema',
		},
	},
	{
		id: 'testcases.list',
		commandPath: ['testcases', 'list'],
		describe: 'List project test cases',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/tcase',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: testCaseFilterOptions,
		supportsCustomFieldFilters: true,
		querySchema: GetPaginatedTCaseRequestSchema,
		queryAdapter: normalizeNullableQuery(['createdAfter', 'createdBefore']),
		responseSchema: GetPaginatedTCaseResponseSchema,
		requestSchemaLinks: {
			query: 'GetPaginatedTCaseRequestSchema',
			response: 'GetPaginatedTCaseResponseSchema',
		},
	},
	{
		id: 'testcases.get',
		commandPath: ['testcases', 'get'],
		describe: 'Get one test case',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/tcase/{tcase}',
		pathParams: [projectParam, tcaseParam],
		bodyMode: 'none',
		responseSchema: FullTCaseSchema,
		requestSchemaLinks: { response: 'FullTCaseSchema' },
	},
	{
		id: 'testcases.count',
		commandPath: ['testcases', 'count'],
		describe: 'Count project test cases',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/tcase/count',
		pathParams: [projectParam],
		bodyMode: 'none',
		queryOptions: testCaseCountOptions,
		supportsCustomFieldFilters: true,
		querySchema: GetTCasesCountRequestSchema,
		queryAdapter: normalizeNullableQuery([
			'search',
			'folders',
			'tags',
			'tagsFilterOp',
			'priorities',
			'draft',
			'types',
			'templateTCaseIds',
			'preconditionIds',
			'stepIds',
			'requirementIds',
			'authorIds',
			'customFields',
			'createdAfter',
			'createdBefore',
			'recursive',
		]),
		responseSchema: GetTCasesCountResponseSchema,
		requestSchemaLinks: {
			query: 'GetTCasesCountRequestSchema',
			response: 'GetTCasesCountResponseSchema',
		},
	},
	{
		id: 'testcases.create',
		commandPath: ['testcases', 'create'],
		describe: 'Create a test case',
		method: 'POST',
		pathTemplate: '/api/public/v0/project/{project}/tcase',
		pathParams: [projectParam],
		bodyMode: 'json',
		bodySchema: CreateTCaseRequestSchema,
		bodyAdapter: normalizeCreateTCaseBody,
		responseSchema: CreateTCaseResponseSchema,
		requestSchemaLinks: {
			body: 'CreateTCaseRequestSchema',
			response: 'CreateTCaseResponseSchema',
		},
	},
	{
		id: 'testcases.update',
		commandPath: ['testcases', 'update'],
		describe: 'Update a test case',
		method: 'PATCH',
		pathTemplate: '/api/public/v0/project/{project}/tcase/{tcase}',
		pathParams: [projectParam, tcaseParam],
		bodyMode: 'json',
		bodySchema: UpdateTCaseRequestSchema,
		bodyAdapter: normalizeUpdateTCaseBody,
		responseSchema: MessageResponseSchema,
		requestSchemaLinks: {
			body: 'UpdateTCaseRequestSchema',
			response: 'MessageResponseSchema',
		},
	},
	{
		id: 'custom-fields.list',
		commandPath: ['custom-fields', 'list'],
		describe: 'List project custom fields',
		method: 'GET',
		pathTemplate: '/api/public/v0/project/{project}/custom-field',
		pathParams: [projectParam],
		bodyMode: 'none',
		responseSchema: GetCustomFieldsResponseSchema,
		requestSchemaLinks: { response: 'GetCustomFieldsResponseSchema' },
	},
	{
		id: 'files.upload',
		commandPath: ['files', 'upload'],
		describe: 'Upload one file',
		method: 'POST',
		pathTemplate: '/api/public/v0/file',
		pathParams: [],
		bodyMode: 'file',
		responseSchema: UploadFileResponseSchema,
		requestSchemaLinks: { response: 'UploadFileResponseSchema' },
	},
	{
		id: 'users.list',
		commandPath: ['users', 'list'],
		describe: 'List users',
		method: 'GET',
		pathTemplate: '/api/public/v0/users',
		pathParams: [],
		bodyMode: 'none',
		responseSchema: GetPublicUsersListResponseSchema,
		requestSchemaLinks: { response: 'GetPublicUsersListResponseSchema' },
	},
	{
		id: 'audit-logs.list',
		commandPath: ['audit-logs', 'list'],
		describe: 'List audit logs',
		method: 'GET',
		pathTemplate: '/api/public/v0/audit-logs',
		pathParams: [],
		bodyMode: 'none',
		queryOptions: [
			option('after', 'Pagination cursor', 'integer'),
			option('count', 'Number of events to return', 'integer'),
		],
		querySchema: GetPublicAuditLogsRequestSchema,
		queryAdapter: normalizeNullableQuery(['after', 'count']),
		responseSchema: GetPublicAuditLogsResponseSchema,
		requestSchemaLinks: {
			query: 'GetPublicAuditLogsRequestSchema',
			response: 'GetPublicAuditLogsResponseSchema',
		},
	},
]

export const apiEndpointSpecById = new Map(apiEndpointSpecs.map((spec) => [spec.id, spec]))
