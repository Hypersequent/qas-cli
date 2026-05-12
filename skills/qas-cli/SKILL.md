---
name: qas-cli
description: CLI tool for uploading JUnit XML, Playwright JSON, and Allure test results to QA Sphere, and accessing the full QA Sphere public API (projects, runs, test cases, results, folders, milestones, tags, and more).
metadata:
  author: Hypersequent
  version: '0.5.0'
---

# qas-cli

CLI for [QA Sphere](https://qasphere.com/) — upload test automation results and access the full QA Sphere API from the command line.

## Installation

```bash
npm install -g qas-cli    # Global install — provides the `qasphere` command
npx qas-cli <command>     # Or run without installing
```

If working within the qas-cli repository itself, use `node build/bin/qasphere.js` (after `npm run build`).

## Prerequisites

- **Node.js** 18.0.0+

### Authentication

Two authentication methods are supported:

#### Interactive Login (OAuth)

```bash
qasphere auth login      # Authenticate via browser-based OAuth device flow
qasphere auth status     # Show current authentication status and token validity
qasphere auth logout     # Clear stored credentials
```

`auth login` prompts for a team name, opens a browser for authorization, and stores OAuth tokens persistently. Requires an interactive terminal (TTY). Tokens are auto-refreshed when they expire (within 5 minutes of expiry).

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

```
qasphere api
├── audit-logs
│   └── list                                    # List audit log entries
├── custom-fields
│   └── list --project-code                     # List custom fields
├── files
│   └── upload --file                           # Upload a file attachment
├── folders
│   ├── list --project-code                     # List folders
│   └── bulk-create --project-code --folders    # Create/update folders
├── milestones
│   ├── list --project-code                     # List milestones
│   └── create --project-code --title           # Create milestone
├── projects
│   ├── list                                    # List all projects
│   ├── get --project-code                      # Get project by code
│   └── create --code --title                   # Create project
├── requirements
│   └── list --project-code                     # List requirements
├── results
│   ├── create --project-code --run-id --tcase-id --status  # Create result
│   └── batch-create --project-code --run-id --items        # Batch create results
├── runs
│   ├── create --project-code --title --type --query-plans  # Create run
│   ├── list --project-code                     # List runs
│   ├── clone --project-code --run-id --title   # Clone run
│   ├── close --project-code --run-id           # Close run
│   └── test-cases
│       ├── list --project-code --run-id        # List test cases in run
│       └── get --project-code --run-id --tcase-id  # Get test case in run
├── settings
│   ├── list-statuses                           # List result statuses
│   └── update-statuses --statuses              # Update custom statuses
├── shared-preconditions
│   ├── list --project-code                     # List shared preconditions
│   └── get --project-code --id                 # Get shared precondition
├── shared-steps
│   ├── list --project-code                     # List shared steps
│   └── get --project-code --id                 # Get shared step
├── tags
│   └── list --project-code                     # List tags
├── test-cases
│   ├── list --project-code                     # List test cases
│   ├── get --project-code --tcase-id           # Get test case
│   ├── count --project-code                    # Count test cases
│   ├── create --project-code --body            # Create test case
│   └── update --project-code --tcase-id --body # Update test case
├── test-plans
│   └── create --project-code --body            # Create test plan
└── users
    └── list                                    # List all users
```

Note: `qasphere api files upload --file ...` uses the public batch upload endpoint internally and returns the first uploaded file from that response.

### Pagination

List commands support pagination via `--page` and `--limit`. Some also support `--sort-field` and `--sort-order` (asc/desc). The `audit-logs list` command uses cursor-based pagination with `--after` and `--count` instead.

### JSON Body Commands

Commands with JSON body mode (e.g., `runs create`, `test-cases create`, `results create`) accept input via:

- **`--body '<json>'`** — Inline JSON string
- **`--body-file <path>`** — Path to a JSON file
- **Individual field options** — e.g., `--title`, `--status`, `--comment`

Field options are merged with `--body`/`--body-file` (field options take precedence). The body must always be valid JSON.

Each subcommand accepts `-h` to show its full signature, all options, examples, and a link to API documentation.
When fetching the online documentation, the link URL can be appended with `.md` to view it in markdown. Use the markdown version first before falling back to the original URL if the endpoint returned a >= 400 status.

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
  --type static --query-plans '[{"tcaseIds": ["abc123", "def456"]}]' \
  | jq -r '.id')

# Upload results using the captured run ID
qasphere api results batch-create \
  --project-code PRJ --run-id "$RUN_ID" \
  --items '[{"tcaseId": "abc123", "status": "passed"}, {"tcaseId": "def456", "status": "failed", "comment": "Timeout"}]'

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
