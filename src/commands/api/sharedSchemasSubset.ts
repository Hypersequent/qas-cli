/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { z } from 'zod'

const sortOrderSchema = z.enum(['asc', 'desc'])
const prioritySchema = z.enum(['low', 'medium', 'high'])
const statusSchema = z.enum([
	'passed',
	'failed',
	'skipped',
	'open',
	'blocked',
	'custom1',
	'custom2',
	'custom3',
	'custom4',
])

const idStringSchema = z.string().min(1)
const dateLikeSchema = z.union([z.string(), z.date()])

const LinkWithTextSchema = z.object({
	url: z.string().min(1),
	text: z.string().min(1),
})

const ResultLinkMetaSchema = z.object({
	id: z.string().optional(),
})

const CreateResultLinkRequestSchema = z.object({
	integrationId: z.string().min(1),
	url: z.string().min(1),
	text: z.string().min(1),
	meta: ResultLinkMetaSchema.optional(),
})

const PaginationFilterSchema = z.object({
	page: z.number().int().positive().optional(),
	limit: z.number().int().positive().optional(),
})

const preconditionRequestSchema = z.object({
	sharedPreconditionId: z.number().int().positive().optional(),
	text: z.string().optional(),
})

const tcaseCustomFieldSchema = z.object({
	value: z.string().optional(),
	isDefault: z.boolean().optional(),
})

const tcaseStepRequestSchema = z.object({
	sharedStepId: z.number().int().positive().optional(),
	description: z.string(),
	expected: z.string(),
})

const createQueryPlanRequestSchema = z.object({
	tcaseIds: z.string().array().nullable().optional(),
	folderIds: z.number().int().array().nullable().optional(),
	tagIds: z.number().int().array().nullable().optional(),
	priorities: prioritySchema.array().nullable().optional(),
})

export const IDResponseSchema = z.object({
	id: z.union([z.number().int(), z.string().min(1)]),
})

export const IDsResponseSchema = z.object({
	ids: z.union([z.number().int().array(), z.number().int().array().array()]),
})

export const MessageResponseSchema = z.object({
	message: z.string().min(1),
})

export const CreateProjectRequestSchema = z.object({
	code: z.string().min(2).max(5),
	title: z.string().min(1).max(255),
	links: LinkWithTextSchema.array().nullable(),
	overviewTitle: z.string().max(255).nullable(),
	overviewDescription: z.string().nullable(),
	skipDefaultFolder: z.boolean().optional(),
	skipDefaultConfigurations: z.boolean().optional(),
	skipDefaultAIRules: z.boolean().optional(),
})

export const PublicProjectSchema = z.object({
	id: idStringSchema,
	code: z.string().min(1),
	title: z.string().min(1),
	description: z.string(),
	overviewTitle: z.string(),
	overviewDescription: z.string(),
	links: LinkWithTextSchema.array().nullable(),
	createdAt: dateLikeSchema,
	updatedAt: dateLikeSchema,
	archivedAt: dateLikeSchema.nullable(),
})

export const GetPublicProjectsResponseSchema = z.object({
	projects: PublicProjectSchema.array().nullable(),
})

export const GetPublicPaginatedFolderRequestSchema = PaginationFilterSchema.merge(
	z.object({
		sortField: z
			.enum(['id', 'project_id', 'title', 'pos', 'parent_id', 'created_at', 'updated_at'])
			.optional(),
		sortOrder: sortOrderSchema.optional(),
	})
)

const FolderSchema = z.object({
	id: z.number().int(),
	parentId: z.number().int(),
	title: z.string().min(1),
	comment: z.string(),
	projectId: z.string().min(1),
	pos: z.number().int(),
})

export const GetPaginatedFolderResponseSchema = z.object({
	total: z.number().int(),
	page: z.number().int(),
	limit: z.number().int(),
	data: FolderSchema.array().nullable(),
})

const PathWithCommentSchema = z.object({
	path: z.string().min(1).max(255).array(),
	comment: z.string().nullable(),
})

export const BulkUpsertFoldersRequestSchema = z.object({
	folders: PathWithCommentSchema.array().nullable(),
})

export const BulkUpsertFoldersResponseSchema = z.object({
	ids: z.number().int().array().array().nullable(),
})

export const GetMilestonesRequestSchema = z.object({
	archived: z.boolean().optional().nullable(),
})

export const GetPublicApiMilestonesResponseSchema = z.object({
	milestones: z
		.object({
			id: z.number().int(),
			title: z.string().min(1),
			createdAt: dateLikeSchema,
			updatedAt: dateLikeSchema,
			archivedAt: dateLikeSchema.nullable(),
			archivedBy: z.number().int().nullable().optional(),
		})
		.array()
		.nullable(),
})

export const CreateMilestonePublicRequestSchema = z.object({
	title: z.string().min(1).max(255),
})

const CreatePlanRunQueryPlanSchema = z.object({
	tcaseIds: z.string().array(),
})

const CreatePlanRunSchema = z.object({
	title: z.string().min(1).max(255),
	assignmentId: z.number().int().positive().optional(),
	configurationId: z.string().min(1).optional(),
	queryPlans: CreatePlanRunQueryPlanSchema.array().length(1),
})

export const CreatePlanRequestSchema = z.object({
	title: z.string().min(1).max(255),
	description: z.string(),
	milestoneId: z.number().int().positive().optional(),
	integrationLink: z.string().url().optional(),
	runs: CreatePlanRunSchema.array().min(1),
})

const sortAndIncludeSchema = (
	sortFields: [string, ...string[]],
	includeValues: [string, ...string[]]
) =>
	z.object({
		sortField: z.enum(sortFields).optional(),
		sortOrder: sortOrderSchema.optional(),
		include: z.enum(includeValues).array().optional(),
	})

export const GetRequirementsRequestSchema = sortAndIncludeSchema(
	['created_at', 'text'],
	['tcaseCount']
)

export const GetRequirementsResponseSchema = z.object({
	requirements: z
		.object({
			id: z.string().min(1),
			text: z.string().min(1),
			url: z.string(),
			tcaseCount: z.number().int().optional(),
			integrationLink: z.any().nullable().optional(),
		})
		.array()
		.nullable(),
})

export const CreateResultRequestSchema = z.object({
	status: statusSchema,
	comment: z.string(),
	links: CreateResultLinkRequestSchema.array().nullable(),
	timeTaken: z.number().nullable(),
})

export const CreateResultsRequestSchema = z.object({
	items: z
		.object({
			tcaseId: z.string().min(1),
			status: statusSchema,
			comment: z.string(),
			links: CreateResultLinkRequestSchema.array().nullable(),
			timeTaken: z.number().nullable(),
		})
		.array()
		.nullable(),
})

export const ListRunsRequestSchema = z.object({
	limit: z.number().int().nullable(),
	closed: z.boolean().nullable(),
	milestoneIds: z.number().int().array().nullable(),
	configurationIds: z.string().array().nullable().optional(),
})

export const GetRunsResponseSchema = z.object({
	runs: z.array(z.any()).nullable(),
	closed: z.number().int(),
	open: z.number().int(),
})

export const CreateRunRequestSchema = z.object({
	type: z.enum(['static', 'static_struct', 'live']),
	title: z.string().min(1).max(255),
	description: z.string(),
	milestoneId: z.number().int().nullable(),
	configurationId: z.string().nullable(),
	assignmentId: z.number().int().nullable(),
	links: z.string().array().nullable(),
	integrationLink: z.string().url().nullable(),
	queryPlans: createQueryPlanRequestSchema.array().min(1),
})

export const CloneRunRequestSchema = z.object({
	runId: z.number().int().positive(),
	title: z.string().min(1).max(255),
	description: z.string(),
	milestoneId: z.number().int().optional(),
	configurationId: z.string().optional(),
	assignmentId: z.number().int().optional(),
	links: z.string().array().optional(),
	integrationLink: z.string().url().or(z.literal('')).optional(),
})

export const ListRunTCasesRequestSchema = z.object({
	tags: z.number().int().array().nullable(),
	tagsFilterOp: z.enum(['and', 'or', 'not']).nullable(),
	priorities: prioritySchema.array().nullable(),
	search: z.string().nullable(),
	customFields: z.record(z.string().min(1), z.string().array().min(1)).nullable(),
	include: z.enum(['folder']).array().nullable(),
})

const RunFolderSchema = z.object({
	id: z.number().int(),
	parentId: z.number().int(),
	title: z.string().min(1),
	comment: z.string().optional(),
	pos: z.number().int().optional(),
})

const RunTCaseOverviewSchema = z.object({
	id: z.string().min(1),
	version: z.number().int(),
	legacyId: z.string().optional(),
	type: z.enum(['standalone', 'filled']).optional(),
	folderId: z.number().int(),
	pos: z.number().int().optional(),
	seq: z.number().int().optional(),
	title: z.string().min(1),
	priority: z.string(),
	status: z.string(),
	isAutomated: z.boolean().optional(),
	isEmpty: z.boolean().optional(),
	templateTCaseId: z.string().nullable().optional(),
})

const RunTCaseOverviewWithFolderSchema = RunTCaseOverviewSchema.extend({
	folder: RunFolderSchema.optional(),
})

export const GetRunTCasesResponseSchema = z.object({
	tcases: RunTCaseOverviewWithFolderSchema.array().nullable(),
})

export const StepSchema = z.lazy(() =>
	z.object({
		id: z.number().int(),
		version: z.number().int(),
		type: z.string(),
		title: z.string().optional(),
		description: z.string().optional(),
		expected: z.string().optional(),
		subSteps: StepSchema.array().optional(),
		isLatest: z.boolean(),
		deletedAt: dateLikeSchema.optional(),
		tcaseCount: z.number().int().optional(),
	})
)

export const PreconditionSchema = z.object({
	projectId: z.string().min(1),
	id: z.number().int(),
	version: z.number().int(),
	title: z.string().optional(),
	type: z.enum(['standalone', 'shared']),
	text: z.string(),
	isLatest: z.boolean(),
	createdAt: dateLikeSchema,
	updatedAt: dateLikeSchema,
	deletedAt: dateLikeSchema.optional(),
	tcaseCount: z.number().int().optional(),
})

export const RunTCaseSchema = RunTCaseOverviewSchema.extend({
	comment: z.string(),
	precondition: PreconditionSchema.nullable().optional(),
	authorId: z.number().int().optional(),
	requirements: z.array(z.any()).nullable().optional(),
	links: LinkWithTextSchema.array().nullable().optional(),
	files: z.array(z.any()).nullable().optional(),
	tags: z.array(z.any()).nullable().optional(),
	steps: StepSchema.array().nullable().optional(),
	customFields: z.record(z.string(), z.any()).nullable().optional(),
	results: z.array(z.any()).nullable().optional(),
	createdAt: dateLikeSchema.optional(),
	isLatestVersion: z.boolean().optional(),
})

const StatusSchema = z.object({
	id: z.enum([
		'open',
		'passed',
		'blocked',
		'failed',
		'skipped',
		'custom1',
		'custom2',
		'custom3',
		'custom4',
	]),
	name: z.string().min(1),
	color: z.enum(['blue', 'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'purple', 'pink']),
	isDefault: z.boolean(),
	isActive: z.boolean(),
	inUse: z.boolean().optional(),
})

export const GetStatusesResponseSchema = z.object({
	statuses: StatusSchema.array(),
})

export const UpdateStatusesRequestSchema = z.object({
	statuses: z
		.object({
			id: z.enum([
				'open',
				'passed',
				'blocked',
				'failed',
				'skipped',
				'custom1',
				'custom2',
				'custom3',
				'custom4',
			]),
			name: z.string().min(1).max(16),
			color: z.enum(['blue', 'gray', 'red', 'orange', 'yellow', 'green', 'teal', 'purple', 'pink']),
			isActive: z.boolean(),
		})
		.array()
		.min(1),
})

export const GetSharedPreconditionsRequestSchema = sortAndIncludeSchema(
	['created_at', 'title'],
	['tcaseCount']
)

export const GetSharedStepsRequestSchema = sortAndIncludeSchema(
	['created_at', 'title'],
	['tcaseCount']
)

export const GetSharedStepsResponseSchema = z.object({
	sharedSteps: StepSchema.array().nullable(),
})

export const GetTagsRequestSchema = sortAndIncludeSchema(['created_at', 'title'], ['tcaseCount'])

export const GetTagsResponseSchema = z.object({
	tags: z
		.object({
			id: z.number().int(),
			title: z.string().min(1),
			tcaseCount: z.number().int().optional(),
		})
		.array()
		.nullable(),
})

export const GetPaginatedTCaseRequestSchema = PaginationFilterSchema.merge(
	z.object({
		sortField: z
			.enum([
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
			])
			.optional(),
		sortOrder: sortOrderSchema.optional(),
		include: z
			.enum([
				'precondition',
				'steps',
				'tags',
				'project',
				'folder',
				'path',
				'requirements',
				'customFields',
				'parameterValues',
			])
			.array()
			.optional(),
		search: z.string().optional(),
		folders: z.number().int().array().optional(),
		tags: z.number().int().array().optional(),
		tagsFilterOp: z.enum(['and', 'or', 'not']).optional(),
		priorities: prioritySchema.array().optional(),
		draft: z.boolean().optional(),
		types: z.enum(['standalone', 'template', 'filled']).array().optional(),
		templateTCaseIds: z.string().array().optional(),
		preconditionIds: z.number().int().array().optional(),
		stepIds: z.number().int().array().optional(),
		requirementIds: z.string().array().optional(),
		authorIds: z.number().int().array().optional(),
		customFields: z.record(z.string().min(1), z.string().array().min(1)).optional(),
		createdAfter: dateLikeSchema.nullable().optional(),
		createdBefore: dateLikeSchema.nullable().optional(),
	})
)

export const FullTCaseSchema = z.object({
	id: z.string().min(1),
	version: z.number().int(),
	legacyId: z.string().optional(),
	seq: z.number().int().optional(),
	type: z.enum(['standalone', 'template', 'filled']).optional(),
	folderId: z.number().int().optional(),
	pos: z.number().int().optional(),
	title: z.string().min(1),
	priority: prioritySchema.optional(),
	comment: z.string().optional(),
	authorId: z.number().int().optional(),
	files: z.array(z.any()).nullable().optional(),
	links: LinkWithTextSchema.array().nullable().optional(),
	isDraft: z.boolean().optional(),
	isLatestVersion: z.boolean().optional(),
	isEmpty: z.boolean().optional(),
	numFilledTCases: z.number().int().optional(),
	templateTCaseId: z.string().optional().nullable(),
	createdAt: dateLikeSchema.optional(),
	updatedAt: dateLikeSchema.optional(),
	precondition: PreconditionSchema.optional(),
	requirements: z.array(z.any()).optional(),
	tags: z.array(z.any()).optional(),
	steps: StepSchema.array().optional(),
	customFields: z.record(z.string(), z.any()).optional(),
	parameterValues: z.array(z.any()).optional(),
	project: z.any().optional(),
	folder: FolderSchema.optional(),
	path: FolderSchema.array().optional(),
})

export const GetPaginatedTCaseResponseSchema = z.object({
	total: z.number().int(),
	page: z.number().int(),
	limit: z.number().int(),
	data: FullTCaseSchema.array().nullable(),
})

export const GetTCasesCountRequestSchema = z.object({
	search: z.string().optional().nullable(),
	folders: z.number().int().array().optional().nullable(),
	tags: z.number().int().array().optional().nullable(),
	tagsFilterOp: z.enum(['and', 'or', 'not']).optional().nullable(),
	priorities: prioritySchema.array().optional().nullable(),
	draft: z.boolean().optional().nullable(),
	types: z.enum(['standalone', 'template', 'filled']).array().optional().nullable(),
	templateTCaseIds: z.string().array().optional().nullable(),
	preconditionIds: z.number().int().array().optional().nullable(),
	stepIds: z.number().int().array().optional().nullable(),
	requirementIds: z.string().array().optional().nullable(),
	authorIds: z.number().int().array().optional().nullable(),
	customFields: z.record(z.string().min(1), z.string().array().min(1)).optional().nullable(),
	createdAfter: dateLikeSchema.nullable().optional(),
	createdBefore: dateLikeSchema.nullable().optional(),
	recursive: z.boolean().nullable(),
})

export const GetTCasesCountResponseSchema = z.object({
	count: z.number().int(),
})

export const CreateTCaseRequestSchema = z.object({
	type: z.enum(['standalone', 'template']),
	folderId: z.number().int(),
	pos: z.number().int().nullable(),
	title: z.string().min(1).max(511),
	priority: prioritySchema,
	comment: z.string().optional(),
	precondition: preconditionRequestSchema.optional(),
	files: z.array(z.any()).nullable(),
	requirements: z
		.object({
			text: z.string().min(1),
			url: z.string(),
		})
		.array()
		.nullable(),
	links: LinkWithTextSchema.array().nullable(),
	tags: z.string().array().nullable(),
	steps: tcaseStepRequestSchema.array().nullable(),
	customFields: z.record(z.string().min(1), tcaseCustomFieldSchema).nullable(),
	parameterValues: z
		.object({
			values: z.record(z.string(), z.string()),
		})
		.array()
		.nullable(),
	filledTCaseTitleSuffixParams: z.string().min(1).array().optional(),
	isDraft: z.boolean(),
})

export const CreateTCaseResponseSchema = z.object({
	id: z.string().min(1),
	seq: z.number().int(),
})

export const UpdateTCaseRequestSchema = z.object({
	id: z.string().min(1).optional(),
	title: z.string().min(1).max(511).optional(),
	priority: prioritySchema.optional(),
	comment: z.string().optional(),
	precondition: preconditionRequestSchema.optional(),
	requirements: z
		.object({
			text: z.string().min(1),
			url: z.string(),
		})
		.array()
		.nullable()
		.optional(),
	links: LinkWithTextSchema.array().nullable().optional(),
	tags: z.string().array().nullable().optional(),
	steps: tcaseStepRequestSchema.array().nullable().optional(),
	files: z.array(z.any()).nullable().optional(),
	customFields: z.record(z.string().min(1), tcaseCustomFieldSchema).optional(),
	parameterValues: z
		.object({
			tcaseId: z.string().min(1),
			values: z.record(z.string(), z.string()),
			priority: prioritySchema.optional(),
		})
		.array()
		.optional(),
	filledTCaseTitleSuffixParams: z.string().min(1).array().optional(),
	isDraft: z.boolean().optional(),
})

export const GetCustomFieldsResponseSchema = z.object({
	customFields: z
		.object({
			id: z.string().min(1),
			type: z.enum(['text', 'dropdown', 'checkbox', 'richtext']),
			systemName: z.string().min(1),
			name: z.string().min(1),
			required: z.boolean(),
			enabled: z.boolean(),
			options: z
				.object({
					id: z.string().min(1),
					value: z.string().min(1),
				})
				.array()
				.nullable(),
			defaultValue: z.string(),
			pos: z.number().int(),
			allowAllProjects: z.boolean(),
			allowedProjectIds: z.string().array().nullable(),
			createdAt: dateLikeSchema,
			updatedAt: dateLikeSchema,
		})
		.array()
		.nullable(),
})

export const UploadFileResponseSchema = z.object({
	id: z.string().min(1),
	url: z.string().min(1),
})

export const GetPublicUsersListResponseSchema = z.object({
	users: z
		.object({
			email: z.string().email(),
			name: z.string().min(1),
			role: z.enum(['owner', 'admin', 'user', 'test-runner', 'viewer']),
			authorizationTypes: z.string().array(),
			totpEnabled: z.boolean(),
			createdAt: dateLikeSchema,
			lastActivity: dateLikeSchema.nullable(),
		})
		.array()
		.nullable(),
})

export const GetPublicAuditLogsRequestSchema = z.object({
	after: z.number().int().gte(0).nullable(),
	count: z.number().int().gte(1).lte(1000).nullable(),
})

export const GetPublicAuditLogsResponseSchema = z.object({
	after: z.number().int(),
	count: z.number().int(),
	events: z
		.object({
			id: z.number().int(),
			user: z
				.object({
					id: z.number().int(),
					name: z.string().min(1),
					email: z.string().email(),
				})
				.nullable(),
			action: z.string(),
			ip: z.string(),
			userAgent: z.string(),
			createdAt: dateLikeSchema,
			meta: z.record(z.string(), z.any()).optional(),
		})
		.array()
		.nullable(),
})
