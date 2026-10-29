---
name: qas-cli
description: CLI tool for uploading JUnit XML, Playwright JSON, and Allure test results to QA Sphere, and accessing the full QA Sphere public API (projects, runs, test cases, results, folders, milestones, tags, and more).
metadata:
  author: Hypersequent
  version: '0.11.0'
---

# qas-cli

CLI for [QA Sphere](https://qasphere.com/) — upload test automation results and access the full QA Sphere API from the command line.

## Installation

```bash
npm install -g qas-cli    # Global install — provides the `qasphere` command
npx qas-cli <command>     # Or run without installing
```

If working within the qas-cli repository itself, use `node build/bin/qasphere.js` (after `pnpm build`).

## Prerequisites

- **Node.js** 22.0.0+

### Authentication

Two authentication methods are supported:

#### Interactive Login (OAuth)

```bash
qasphere auth login      # Authenticate via browser-based OAuth device flow
qasphere auth status     # Show current authentication status and token validity
qasphere auth logout     # Clear stored credentials
```

`auth login` prompts for a team name, opens a browser for authorization, and stores OAuth tokens persistently. Requires an interactive terminal (TTY). Tokens are auto-refreshed when they expire (within 5 minutes of expiry). Afterwards it offers to install this skill for detected coding agents.

Credentials are stored in the system keyring (`qasphere-cli` service) when available, with fallback to `~/.config/qasphere/credentials.json` (mode `0600`).

#### API Key

Set `QAS_TOKEN` and `QAS_URL` via environment variables, `.env` file, or `.qaspherecli` file.

### Credential Resolution Order

Credentials are resolved in this order (first match wins):

1. **Environment variables** — `export QAS_TOKEN=... QAS_URL=...`
2. **`.env` file** — Standard dotenv file in the current working directory
3. **Keyring / credentials file** — OAuth tokens saved by `qasphere auth login`
4. **`.qaspherecli` file** — Searched from the current directory upward to filesystem root

Both `.env` and `.qaspherecli` use the same `KEY=value` format:

```
QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
QAS_URL=https://qas.eu1.qasphere.com
```

If credentials are missing, the CLI prints a setup guide to stderr and exits with code 1.

## Skill Commands

```bash
qasphere skill install     # Install or update this skill for every detected coding agent
qasphere skill status      # Show the installed skill version for each agent
qasphere skill uninstall   # Remove this skill from every agent
```

`install` takes `--agent <id>` (repeatable) to target specific agents. This skill's `metadata.version` matches the CLI version; the CLI updates an older installed copy on its next run and reports it on stderr. If the update fails (e.g. in a sandbox), it warns at most once a day: ask the user to run `qasphere skill install` outside the sandbox.

## Upload Commands

Upload test results to QA Sphere test runs. All three share the same options.

```bash
qasphere junit-upload [options] <files..>
qasphere playwright-json-upload [options] <files..>
qasphere allure-upload [options] <directories..>
```

### Upload Options

| Option                  | Description                                                                                                                                                             |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-r, --run-url <url>`   | URL of an existing test run to upload into. Project code and run ID are extracted from the URL.                                                                         |
| `--project-code <code>` | Project code for creating a new run (when `--run-url` is not set). Can be auto-detected from markers but explicit is recommended.                                       |
| `--run-name <template>` | Name template for the new test run. Supports `{env:VAR}` and date placeholders (see below). Default: `"Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}"` |
| `--create-tcases`       | Create new test cases in QA Sphere for results that have no valid marker. Only applies when creating a new run (no `--run-url`).                                        |
| `--attachments`         | Detect and upload file attachments with each test result.                                                                                                               |
| `--force`               | Ignore API request errors, invalid test cases, or missing attachments and continue uploading.                                                                           |
| `--ignore-unmatched`    | Suppress individual unmatched test messages; show a summary count only.                                                                                                 |
| `--skip-report-stdout`  | When to skip stdout from test results. Choices: `on-success`, `never` (default).                                                                                        |
| `--skip-report-stderr`  | When to skip stderr from test results. Choices: `on-success`, `never` (default).                                                                                        |
| `--verbose`             | Show full stack traces on errors.                                                                                                                                       |

**Two modes:**

- **Existing run** — Pass `--run-url` to upload into an existing test run.
- **New run** — Omit `--run-url` to create a new run. Use `--project-code`, `--run-name`, and `--create-tcases` to control creation.

### Run Name Template Placeholders

| Placeholder      | Description                                |
| ---------------- | ------------------------------------------ |
| `{env:VAR_NAME}` | Environment variable value                 |
| `{YYYY}`, `{YY}` | 4-digit / 2-digit year                     |
| `{MMM}`, `{MM}`  | 3-letter month (Jan, Feb…) / 2-digit month |
| `{DD}`           | 2-digit day                                |
| `{HH}`, `{hh}`   | 24-hour / 12-hour hour                     |
| `{mm}`, `{ss}`   | Minutes / Seconds                          |
| `{AMPM}`         | AM/PM                                      |

### Test Case Matching

Results are matched to QA Sphere test cases via markers:

- **Hyphenated** (all formats): `PRJ-123` anywhere in test name
- **Underscore** (JUnit only): `test_prj123_login` — name must start with `test`
- **CamelCase** (JUnit only): `TestPrj123Login` — name must start with `Test`
- **Playwright annotations**: `{ type: "test case", description: "<qasphere-url>" }`
- **Allure TMS links**: `{ type: "tms", url: "<qasphere-url>" }`

If markers are not present, use `--create-tcases` to automatically create test cases in QA Sphere.

## API Command Tree

```
qasphere api <resource> <action> [options]
```

All commands output JSON to stdout, errors to stderr. Exit code 0 on success, 1 on failure.

Each line lists the options a command requires. Commands that send a request body also take it whole with `--body '<json>'` or `--body-file <path>`, and their field options override its keys (see JSON Body Commands below). Run any command with `-h` to see all of its options.

```
qasphere api
├── ai-rules
│   └── list --project-code                                                       # List AI rules that apply in a project
├── audit-logs
│   └── list                                                                      # List audit log entries
├── configurations
│   ├── list --project-code                                                       # List configurations
│   ├── get --project-code --configuration-id                                     # Get configuration
│   ├── create --project-code --title                                             # Create configuration
│   ├── update --project-code --configuration-id --title                          # Rename configuration
│   └── delete --project-code --configuration-id                                  # Delete configuration
├── custom-fields
│   └── list --project-code                                                       # List custom fields
├── files
│   └── upload --file                                                             # Upload a file attachment
├── folders
│   ├── list --project-code                                                       # List folders
│   ├── get --project-code --folder-id                                            # Get folder
│   ├── tree --project-code                                                       # Get folder tree
│   ├── path --project-code --folder-id                                           # Get folder path
│   ├── create --project-code --title                                             # Create folder
│   ├── update --project-code --folder-id                                         # Rename folder or edit its comment
│   ├── move --project-code --new-parent-id --items                               # Move folders
│   ├── copy --project-code --folder-ids                                          # Copy folders
│   ├── delete --project-code --folder-ids                                        # Delete folders (to trash)
│   └── bulk-create --project-code --folders                                      # Create/update folders
├── integrations
│   ├── list --project-code                                                       # List a project's integrations
│   ├── get --project-code --integration-id                                       # Get integration
│   ├── jira
│   │   ├── issues
│   │   │   ├── search --project-code --integration-id                            # Search Jira issues
│   │   │   ├── get --project-code --integration-id --issue-id                    # Get Jira issue
│   │   │   └── create --project-code --integration-id --summary --issue-type-id  # Create Jira issue
│   │   └── issue-types
│   │       ├── list --project-code --integration-id                              # List Jira issue types
│   │       └── fields --project-code --integration-id --issue-type-id            # List an issue type's fields
│   ├── github
│   │   └── issues
│   │       ├── get --project-code --integration-id --issue-number                # Get GitHub issue
│   │       └── create --project-code --integration-id --summary                  # Create GitHub issue
│   └── linear
│       └── issues
│           ├── search --project-code --integration-id                            # Search Linear issues
│           ├── get --project-code --integration-id --issue-id                    # Get Linear issue
│           └── create --project-code --integration-id --summary                  # Create Linear issue
├── milestones
│   ├── list --project-code                                                       # List milestones
│   ├── get --project-code --milestone-id                                         # Get milestone
│   ├── create --project-code --title                                             # Create milestone
│   ├── update --project-code --milestone-id                                      # Rename milestone
│   ├── archive --project-code --milestone-id                                     # Archive milestone, closing its plans and runs
│   ├── unarchive --project-code --milestone-id                                   # Unarchive milestone
│   └── delete --project-code --milestone-id                                      # Delete milestone with its plans and runs (to trash)
├── projects
│   ├── list                                                                      # List all projects
│   ├── get --project-code                                                        # Get project
│   ├── create --code --title                                                     # Create project
│   ├── update --project-code                                                     # Update project (owner/admin)
│   └── users
│       └── list --project-code                                                   # List users with access to project
├── requirements
│   ├── list --project-code                                                       # List requirements
│   ├── get --project-code --requirement-id                                       # Get requirement
│   ├── create --project-code --text                                              # Create requirement
│   ├── update --project-code --requirement-id                                    # Update requirement
│   └── delete --project-code --requirement-id                                    # Delete requirement
├── results
│   ├── get --project-code --run-id --result-id                                   # Get result
│   ├── create --project-code --run-id --tcase-id --status                        # Create result
│   ├── batch-create --project-code --run-id --items                              # Batch create results
│   └── update --project-code --run-id --result-id                                # Edit a result's comment, time taken or links
├── runs
│   ├── list --project-code                                                       # List runs
│   ├── list-assigned                                                             # List open runs assigned to you
│   ├── open-status-counts --project-code                                         # Status counts of open runs
│   ├── get --project-code --run-id                                               # Get run
│   ├── selections --project-code --run-id                                        # Get a run's query plans
│   ├── folders --project-code --run-id                                           # Get a run's folder tree
│   ├── status-counts --project-code --run-id                                     # Count a run's test cases by status
│   ├── preview --project-code --run-type --query-plans                           # Preview a selection's test cases
│   ├── create --project-code --title --type --query-plans                        # Create run
│   ├── clone --project-code --run-id --title                                     # Clone run
│   ├── update --project-code --run-id                                            # Update run
│   ├── close --project-code --run-id                                             # Close run
│   ├── reopen --project-code --run-id                                            # Reopen run
│   ├── bulk-close --project-code --run-ids                                       # Close runs
│   ├── bulk-reopen --project-code --run-ids                                      # Reopen runs
│   ├── move --project-code --run-ids --milestone-id                              # Move runs to milestone
│   ├── delete --project-code --run-ids                                           # Delete runs (to trash)
│   ├── test-cases
│   │   ├── list --project-code --run-id                                          # List test cases in run
│   │   ├── get --project-code --run-id --tcase-id                                # Get test case in run
│   │   └── update-version --project-code --run-id --tcase-id                     # Move to the latest test case version
│   └── logs
│       ├── list --project-code --run-id                                          # List run logs
│       └── create --project-code --run-id --comment                              # Append a run-level log message (e.g. CI/CD or automation framework output) to a test run.
├── settings
│   ├── list-statuses                                                             # List result statuses
│   └── update-statuses --statuses                                                # Update custom statuses
├── shared-preconditions
│   ├── list --project-code                                                       # List shared preconditions
│   ├── get --project-code --id                                                   # Get shared precondition
│   ├── create --project-code --title --text                                      # Create shared precondition
│   ├── update --project-code --id                                                # Update shared precondition
│   └── delete --project-code --id                                                # Delete shared precondition
├── shared-steps
│   ├── list --project-code                                                       # List shared steps
│   ├── get --project-code --id                                                   # Get shared step
│   ├── create --project-code --title --sub-steps                                 # Create shared step
│   ├── update --project-code --id                                                # Update shared step
│   └── delete --project-code --id                                                # Delete shared step
├── tags
│   ├── list --project-code                                                       # List tags
│   ├── create --project-code --title                                             # Create tag
│   ├── update --project-code --tag-id --title                                    # Update tag
│   ├── rename --project-code --tags                                              # Rename several tags
│   └── delete --project-code --tag-ids                                           # Delete tags
├── test-cases
│   ├── list --project-code                                                       # List test cases
│   ├── count --project-code                                                      # Count test cases
│   ├── get --project-code --tcase-id                                             # Get test case
│   ├── get-version --project-code --tcase-id --tcase-version                     # Get a test case version
│   ├── create --project-code --title --type --folder-id --priority               # Create test case
│   ├── copy --project-code --tcase-ids --target-folder-id                        # Copy test cases
│   ├── update --project-code --tcase-id                                          # Update test case
│   ├── rollback --project-code --tcase-id --tcase-version                        # Roll back to a version
│   ├── move --project-code --new-parent-id --items                               # Move test cases
│   ├── update-priority --project-code --tcase-ids --priority                     # Set priority
│   ├── update-tags --project-code --tcase-ids                                    # Add/remove tags
│   ├── update-requirements --project-code --tcase-ids                            # Add/remove requirements
│   ├── delete --project-code --tcase-ids                                         # Delete test cases (to trash)
│   └── results
│       └── list --project-code --tcase-id                                        # List a test case's result history
├── test-plans
│   ├── list --project-code                                                       # List test plans
│   ├── get --project-code --plan-id                                              # Get test plan with its runs
│   ├── create --project-code --title --runs                                      # Create test plan
│   ├── update --project-code --plan-id                                           # Update test plan
│   ├── update-run --project-code --plan-id --run-id                              # Update a run of a test plan
│   ├── close --project-code --plan-id                                            # Close test plan and its runs
│   ├── reopen --project-code --plan-id                                           # Reopen test plan and its runs
│   ├── move --project-code --plan-ids --milestone-id                             # Move test plans to milestone
│   └── delete --project-code --plan-id                                           # Delete test plan with its runs (to trash)
├── trash
│   ├── list --project-code                                                       # List trash entries
│   └── restore --project-code --ids                                              # Restore trash entries
└── users
    └── list                                                                      # List all users
```

Note: `qasphere api files upload --file ...` uses the public batch upload endpoint internally and returns the first uploaded file from that response.

Deleted folders, test cases, runs, test plans and milestones go to the project's trash, where `qasphere api trash restore` brings them back within 60 days. A test plan comes back with its runs, and a milestone with its test plans and runs. Deleted tags, requirements, shared steps, shared preconditions and configurations can't be restored.

`test-cases list` and `test-cases count` also filter by custom field, with `--cf-<system name> <value>` (system names come from `custom-fields list`). Repeat the option for several values of one field, which match with OR: `--cf-automation Automated --cf-automation Partial`.

### Pagination

List commands that take `--offset` and `--limit` return one page, as `{"total": N, "offset": O, "limit": L, "data": [...]}`. `--offset` defaults to 0 and `--limit` to 100, at most 1000; `--limit 0` returns only the total. Use `--offset` to read further pages. Most also take `--sort-field` and `--sort-order` (asc/desc). The `audit-logs list` command uses cursor-based pagination with `--after` and `--count` instead, and the Jira and Linear issue searches take `--next-page-token`: pass each response's `nextPageToken` until `isLast` is `true`.

### JSON Body Commands

Commands with JSON body mode (e.g., `runs create`, `test-cases create`, `results create`) accept input via:

- **`--body '<json>'`** — Inline JSON string
- **`--body-file <path>`** — Path to a JSON file
- **Individual field options** — e.g., `--title`, `--status`, `--comment`

Field options are merged with `--body`/`--body-file` (field options take precedence). The body must always be valid JSON.

Each subcommand accepts `-h` to show its full signature, all options, examples, and a link to API documentation.
When fetching the online documentation, view it in markdown by dropping the trailing slash and any `#` fragment from the link and appending `.md` (e.g. `https://qasphere.com/docs/api/run/#list-runs` → `https://qasphere.com/docs/api/run.md`). Use the markdown version first before falling back to the original URL if the endpoint returned a >= 400 status.

## Common Workflows

### Upload JUnit results to an existing run

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/PRJ/run/23 ./test-results.xml
```

### Create a run, upload results, and close it

```bash
# Create a run and capture the run ID from the JSON response
RUN_ID=$(qasphere api runs create \
  --project-code PRJ --title "CI Build $BUILD_NUMBER" \
  --type static --query-plans '[{"tcaseIds": ["4", "5"]}]' \
  | jq -r '.id')

# Upload results using the captured run ID
qasphere api results batch-create \
  --project-code PRJ --run-id "$RUN_ID" \
  --items '[{"tcaseId": "4", "status": "passed"}, {"tcaseId": "5", "status": "failed", "comment": "Timeout"}]'

# Close the run
qasphere api runs close --project-code PRJ --run-id "$RUN_ID"
```

### Bulk-create folders and test cases

```bash
qasphere api folders bulk-create \
  --project-code PRJ \
  --folders '[{"path": ["Authentication", "Login"]}, {"path": ["Authentication", "OAuth"]}]'

qasphere api test-cases create \
  --project-code PRJ \
  --body '{"title": "Login with valid credentials", "type": "standalone", "folderId": 1, "priority": "high"}'
```

## Error Handling

- **Missing credentials**: If `QAS_TOKEN` or `QAS_URL` are not found in env vars, `.env`, or `.qaspherecli`, the CLI prints a setup guide to stderr and exits with code 1.
- **Validation errors**: Invalid CLI arguments or API request validation failures are reported to stderr with the offending option name.
- **API errors**: HTTP errors from QA Sphere are formatted and printed to stderr. Use `--verbose` for full stack traces.
- **Upload failures**: By default, the CLI aborts on the first error. Use `--force` to skip failures and continue uploading remaining results.
