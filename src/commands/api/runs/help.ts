import { apiDocsEpilog } from '../utils'

export default {
	// Reusable fields shared across commands
	'project-code': `Project code identifying the QA Sphere project.
This is the short uppercase code visible in the project URL (e.g., "PRJ" from /project/PRJ/...).`,
	'run-id': 'Test run ID.',

	create: {
		command: 'Create a new test run.',
		title: `Display title for the test run (1-255 characters).
Must be unique within the project.
If a run with this exact title already exists, the API will return an error.`,
		type: `Run type.

"static": flat list of test cases fixed after creation.
No propagation of versioned property updates.
Single query plan only. Supports tcaseIds and filter-based selection.

"static_struct": test cases grouped by folder structure, fixed after creation
but updates to versioned properties (title, steps) are reflected for cases with open statuses.
Single query plan only. Supports tcaseIds and filter-based selection.

"live": dynamic run that automatically adds/removes cases matching filter criteria.
Only filter-based selection allowed (folderIds, tagIds, priorities - no tcaseIds).
Supports multiple query plans combined via union.
Reflects versioned property updates for open-status cases.`,
		description: 'Optional description for the test run (max 512 characters, supports HTML).',
		'milestone-id': `ID of the milestone to associate with this run.
Must be an active, non-archived milestone.
Use "qas api milestones list" to find available milestone IDs.`,
		'configuration-id': `ID of the configuration to associate with this run.
Use "qas api configurations list" to find available configuration IDs.`,
		'assignment-id': `ID of the user to assign to this run.
Must be an active user with a role above Viewer.
All test cases in the run will be assigned to this user.`,
		'query-plans': `JSON array of query plan objects that select which test cases to include.
Accepts inline JSON or @filename (reads JSON from file).

Each plan can have:
  tcaseIds (string[]) - specific test case IDs (not allowed for "live" runs)
  folderIds (number[]) - include all cases in folders (includes subfolders)
  tagIds (number[]) - filter by tags
  priorities (string[], values: "low", "medium", "high") - filter by priority

Within a plan, filters are combined with AND.
For "static" and "static_struct" runs, exactly one query plan is allowed.
For "live" runs, multiple plans are combined via OR (union).
Only standalone and filled test case types are included.

Example: '[{"folderIds": [1, 2], "priorities": ["high"]}]'`,
		epilog: apiDocsEpilog('run', 'create-new-run'),
	},

	list: {
		command: 'List test runs in a project.',
		epilog: apiDocsEpilog('run', 'list-project-runs'),
		closed: 'Filter by closed status. If true, returns only closed runs.',
		'milestone-ids': `Comma-separated milestone IDs to filter by (e.g., "1,2,3").`,
		limit: 'Maximum number of items to return.',
	},

	clone: {
		command: 'Clone an existing test run.',
		title: `Display title for the cloned run (1-255 characters).`,
		description: 'Optional description for the cloned run (supports HTML).',
		'milestone-id': 'Milestone ID for the cloned run.',
		'assignment-id': 'Assignment ID for the cloned run.',
		epilog: apiDocsEpilog('run', 'clone-existing-run'),
	},

	close: {
		command: 'Close a test run.',
		epilog: apiDocsEpilog('run', 'close-run'),
	},

	tcases: {
		command: 'Manage test cases within a run.',
		list: {
			command: 'List test cases in a run.',
			epilog: apiDocsEpilog('run', 'list-run-test-cases'),
			search: 'Search text to filter test cases.',
			tags: 'Comma-separated tag IDs to filter by.',
			priorities: 'Comma-separated priorities to filter by (e.g., "low,high").',
			limit: 'Maximum number of items to return.',
			include: 'Include additional fields. Use "folder" to include folder details.',
			'sort-field': 'Field to sort by.',
			'sort-order': 'Sort direction (asc or desc).',
		},
		get: {
			command: 'Get a specific test case in a run.',
			'tcase-id': 'Test case ID or legacy ID.',
			epilog: apiDocsEpilog('run', 'get-run-test-case'),
		},
	},

	examples: [
		{
			usage:
				'$0 api runs create --project-code PRJ --title "Sprint 1" --type static --query-plans \'[{"tcaseIds": ["abc123"]}]\'',
			description: 'Create a static run with specific test cases',
		},
	],
} as const
