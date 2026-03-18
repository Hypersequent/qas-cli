import { apiDocsEpilog } from '../utils'

const bodyFields = `
Fields:
  title (string) - Test case title (1-511 characters).
  type ("standalone" | "template") - Test case type.
  folderId (number) - ID of the folder to place the test case in.
  priority ("low" | "medium" | "high") - Priority level.
  comment (string) - Comment or description.
  tags (string[]) - Array of tag names.
  isDraft (boolean) - Whether the test case is a draft.
  steps (object[]) - Array of step objects, each with:
    description (string, required), expected (string), sharedStepId (number).
  precondition (object) - Either { text: string } or { sharedPreconditionId: number }.
  pos (number) - Position index within the folder (non-negative integer).
  requirements (object[]) - Array of { text: string, url: string (max 255 chars) }.
  links (object[]) - Array of { text: string, url: string }.`

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.`,
	'tcase-id': 'Test case ID.',
	draft: 'Filter by draft status (true or false).',
	title: 'Test case title (1-511 characters).',
	priority: 'Priority level (low, medium, or high).',
	comment: 'Comment or description.',
	tags: 'Comma-separated tag names (e.g., "smoke,regression").',
	'is-draft': 'Whether the test case is a draft.',
	steps: `JSON array of step objects. Accepts inline JSON or @filename.
Each step has: description (string, required), expected (string), sharedStepId (number).
Example: '[{"description": "Click login", "expected": "Page loads"}]'`,

	// Command-specific groups
	list: {
		command: 'List test cases in a project.',
		epilog: apiDocsEpilog('tcases', 'list-project-test-cases'),
		page: 'Page number for pagination (starts at 1).',
		limit: 'Maximum number of items per page.',
		folders: 'Comma-separated folder IDs to filter by (e.g., "1,2,3").',
		tags: 'Comma-separated tag IDs to filter by (e.g., "1,2,3").',
		priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
		search: 'Search text to filter test cases.',
		types: 'Comma-separated test case types to filter by (e.g., "standalone,template").',
		recursive: 'If true, include test cases in subfolders when filtering by folders.',
		'sort-field': 'Field to sort by.',
		'sort-order': 'Sort direction (asc or desc).',
		include: 'Comma-separated additional fields to include (e.g., "tags,requirements").',
	},

	get: {
		command: 'Get a test case by ID.',
		epilog: apiDocsEpilog('tcases', 'get-test-case'),
	},

	count: {
		command: 'Count test cases matching filters.',
		epilog: apiDocsEpilog('tcases', 'get-test-case-count'),
		folders: 'Comma-separated folder IDs to filter by (e.g., "1,2,3").',
		tags: 'Comma-separated tag IDs to filter by (e.g., "1,2,3").',
		priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
		recursive: 'If true, include test cases in subfolders when filtering by folders.',
	},

	create: {
		command: 'Create a new test case.',
		type: 'Test case type (standalone or template).',
		'folder-id': 'ID of the folder to place the test case in.',
		body: `JSON object for the full request body.
Accepts inline JSON or @filename (reads JSON from file).
Individual field options (--title, --tags, etc.) override body fields when both are provided.
${bodyFields}`,
		epilog: apiDocsEpilog('tcases', 'create-test-case'),
	},

	update: {
		command: 'Update an existing test case.',
		body: `JSON object for the request body.
Accepts inline JSON or @filename (reads JSON from file).
Individual field options (--title, --tags, etc.) override body fields when both are provided.
All fields are optional. Only provided fields will be updated.
${bodyFields}`,
		epilog: apiDocsEpilog('tcases', 'update-test-case'),
	},

	examples: [
		{
			usage:
				'$0 api test-cases create --project-code PRJ --body \'{"title": "Login test", "type": "standalone", "folderId": 1, "priority": "high"}\'',
			description: 'Create a test case',
		},
	],
} as const
