---
name: qas-cli
description: CLI tool for managing QA Sphere test cases, runs, and results. Upload test automation results and access the full QA Sphere public API from the command line.
metadata:
  author: Hypersequent
  version: '0.5.0'
---

# qas-cli

## What This Tool Does

qas-cli is a CLI for [QA Sphere](https://qasphere.com/) that does two things:

1. **Upload test results** — Parse JUnit XML, Playwright JSON, or Allure result directories and upload them to QA Sphere test runs, matching results to test cases via markers (e.g., `PRJ-123`).
2. **Access the QA Sphere API** — Full CRUD access to resource types (projects, test cases, runs, results, folders, tags, milestones, etc.) with JSON output for scripting.

## When to Use

- Upload CI/CD test automation results to QA Sphere
- Create and manage test runs programmatically
- Query test cases, results, or project data from QA Sphere
- Automate QA workflows (create runs, submit results, close runs)
- Bulk-create folders, test cases, or results
- Audit log retrieval and status management

## Prerequisites

- **Node.js** 18.0.0 or higher
- **`QAS_TOKEN`** — QA Sphere API token ([how to generate](https://docs.qasphere.com/api/authentication))
- **`QAS_URL`** — Base URL of your QA Sphere instance (e.g., `https://qas.eu2.qasphere.com`)

Set these as environment variables, in `.env`, or in a `.qaspherecli` file in the project directory.

## Installation

```bash
# Via npx (no install)
npx qas-cli --version

# Via npm (global install)
npm install -g qas-cli
qasphere --version
```

## Upload Commands

Upload test results to QA Sphere test runs. All three commands share the same options.

```bash
qasphere junit-upload [options] <files..>
qasphere playwright-json-upload [options] <files..>
qasphere allure-upload [options] <directories..>
```

### Key Options

| Option                  | Description                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `-r, --run-url <url>`   | Upload to an existing test run                                                                 |
| `--project-code <code>` | Project code for new run creation                                                              |
| `--run-name <template>` | Name template with placeholders: `{YYYY}`, `{MM}`, `{DD}`, `{HH}`, `{mm}`, `{ss}`, `{env:VAR}` |
| `--create-tcases`       | Auto-create test cases for results without markers                                             |
| `--attachments`         | Upload detected attachments                                                                    |
| `--force`               | Ignore errors for invalid test cases or attachments                                            |
| `--ignore-unmatched`    | Show summary instead of individual unmatched test errors                                       |
| `--skip-report-stdout`  | `on-success` or `never` (default: `never`)                                                     |
| `--skip-report-stderr`  | `on-success` or `never` (default: `never`)                                                     |

### Test Case Matching

Results are matched to QA Sphere test cases via markers:

- **Hyphenated** (all formats): `PRJ-123` anywhere in test name
- **Underscore** (JUnit only): `test_prj123_login` — name must start with `test`
- **CamelCase** (JUnit only): `TestPrj123Login` — name must start with `Test`
- **Playwright annotations**: `{ type: "test case", description: "<qasphere-url>" }`
- **Allure TMS links**: `{ type: "tms", url: "<qasphere-url>" }`

`<qasphere-url>` is the full URL to a test case in QA Sphere, e.g., `https://qas.eu1.qasphere.com/project/PRJ/tcase/123`

## API Commands

Direct access to the QA Sphere API. All commands output JSON to stdout, errors to stderr.

```
qasphere api <resource> <action> [options]
```

### Conventions

- **`--project-code`** per-command (not global); some endpoints are org-scoped
- **Comma-separated arrays**: `--tags 1,2,3`, `--milestone-ids 1,2`
- **JSON arguments**: inline JSON or `@filename` — e.g., `--body @tcase.json`
- **`--verbose`** for stack traces on errors
- **Result statuses**: `passed`, `failed`, `blocked`, `skipped`, `open`, `custom1`–`custom4`

### Resource Reference

#### audit-logs

| Subcommand | Description             | Required | Optional                               |
| ---------- | ----------------------- | -------- | -------------------------------------- |
| `list`     | List audit log entries. | —        | `--after` (cursor), `--count` (number) |

#### custom-fields

| Subcommand | Description                          | Required         | Optional |
| ---------- | ------------------------------------ | ---------------- | -------- |
| `list`     | List all custom fields in a project. | `--project-code` | —        |

#### files

| Subcommand | Description               | Required        | Optional |
| ---------- | ------------------------- | --------------- | -------- |
| `upload`   | Upload a file attachment. | `--file <path>` | —        |

#### folders

| Subcommand    | Description                                | Required                      | Optional                                            |
| ------------- | ------------------------------------------ | ----------------------------- | --------------------------------------------------- |
| `list`        | List folders in a project.                 | `--project-code`              | `--page`, `--limit`, `--sort-field`, `--sort-order` |
| `bulk-create` | Create or update multiple folders at once. | `--project-code`, `--folders` | —                                                   |

Folders JSON: `[{"path": ["Parent", "Child"], "comment": "optional"}]`

#### milestones

| Subcommand | Description                   | Required                    | Optional     |
| ---------- | ----------------------------- | --------------------------- | ------------ |
| `list`     | List milestones in a project. | `--project-code`            | `--archived` |
| `create`   | Create a new milestone.       | `--project-code`, `--title` | —            |

#### projects

| Subcommand | Description            | Required            | Optional                                                |
| ---------- | ---------------------- | ------------------- | ------------------------------------------------------- |
| `list`     | List all projects.     | —                   | —                                                       |
| `get`      | Get a project by code. | `--project-code`    | —                                                       |
| `create`   | Create a new project.  | `--code`, `--title` | `--links`, `--overview-title`, `--overview-description` |

#### requirements

| Subcommand | Description                     | Required         | Optional                                    |
| ---------- | ------------------------------- | ---------------- | ------------------------------------------- |
| `list`     | List requirements in a project. | `--project-code` | `--sort-field`, `--sort-order`, `--include` |

#### results

| Subcommand     | Description                                      | Required                                               | Optional                               |
| -------------- | ------------------------------------------------ | ------------------------------------------------------ | -------------------------------------- |
| `create`       | Create a result for a test case in a run.        | `--project-code`, `--run-id`, `--tcase-id`, `--status` | `--comment`, `--time-taken`, `--links` |
| `batch-create` | Create results for multiple test cases in a run. | `--project-code`, `--run-id`, `--items`                | —                                      |

Status values: `passed`, `failed`, `blocked`, `skipped`, `open`, `custom1`–`custom4`

Batch items JSON: `[{"tcaseId": "abc", "status": "passed", "comment": "optional", "timeTaken": 1000}]`

#### runs

| Subcommand    | Description                        | Required                                               | Optional                                                                        |
| ------------- | ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `create`      | Create a new test run.             | `--project-code`, `--title`, `--type`, `--query-plans` | `--description`, `--milestone-id`, `--configuration-id`, `--assignment-id`      |
| `list`        | List test runs in a project.       | `--project-code`                                       | `--closed`, `--milestone-ids`, `--limit`                                        |
| `clone`       | Clone an existing test run.        | `--project-code`, `--run-id`, `--title`                | `--description`, `--milestone-id`, `--assignment-id`                            |
| `close`       | Close a test run.                  | `--project-code`, `--run-id`                           | —                                                                               |
| `tcases list` | List test cases in a run.          | `--project-code`, `--run-id`                           | `--search`, `--tags`, `--priorities`, `--limit`, `--sort-field`, `--sort-order` |
| `tcases get`  | Get a specific test case in a run. | `--project-code`, `--run-id`, `--tcase-id`             | —                                                                               |

Run types: `static` (flat), `static_struct` (grouped by folders), `live` (dynamic filters)

Query plans JSON: `[{"tcaseIds": ["abc"], "folderIds": [1], "tagIds": [1], "priorities": ["high"]}]`

#### settings

| Subcommand        | Description                                  | Required     | Optional |
| ----------------- | -------------------------------------------- | ------------ | -------- |
| `list-statuses`   | List all result statuses (including custom). | —            | —        |
| `update-statuses` | Update custom result statuses.               | `--statuses` | —        |

Statuses JSON: `[{"id": "custom1", "name": "Deferred", "color": "#FF9800", "isActive": true}]`

#### shared-preconditions

| Subcommand | Description                             | Required                 | Optional                                    |
| ---------- | --------------------------------------- | ------------------------ | ------------------------------------------- |
| `list`     | List shared preconditions in a project. | `--project-code`         | `--sort-field`, `--sort-order`, `--include` |
| `get`      | Get a shared precondition by ID.        | `--project-code`, `--id` | —                                           |

#### shared-steps

| Subcommand | Description                     | Required                 | Optional                                    |
| ---------- | ------------------------------- | ------------------------ | ------------------------------------------- |
| `list`     | List shared steps in a project. | `--project-code`         | `--sort-field`, `--sort-order`, `--include` |
| `get`      | Get a shared step by ID.        | `--project-code`, `--id` | —                                           |

#### tags

| Subcommand | Description             | Required         | Optional |
| ---------- | ----------------------- | ---------------- | -------- |
| `list`     | List tags in a project. | `--project-code` | —        |

#### test-cases

| Subcommand | Description                        | Required                                 | Optional                                                                                                                                  |
| ---------- | ---------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `list`     | List test cases in a project.      | `--project-code`                         | `--page`, `--limit`, `--folders`, `--tags`, `--priorities`, `--search`, `--types`, `--draft`, `--sort-field`, `--sort-order`, `--include` |
| `get`      | Get a test case by ID.             | `--project-code`, `--tcase-id`           | —                                                                                                                                         |
| `count`    | Count test cases matching filters. | `--project-code`                         | `--folders`, `--tags`, `--priorities`, `--search`, `--types`, `--draft`                                                                   |
| `create`   | Create a new test case.            | `--project-code`, `--body`               | —                                                                                                                                         |
| `update`   | Update an existing test case.      | `--project-code`, `--tcase-id`, `--body` | —                                                                                                                                         |

Create body JSON: `{"title": "Login test", "type": "standalone", "folderId": 1, "priority": "high"}`

#### test-plans

| Subcommand | Description             | Required                   | Optional |
| ---------- | ----------------------- | -------------------------- | -------- |
| `create`   | Create a new test plan. | `--project-code`, `--body` | —        |

Body JSON: `{"title": "Release Plan", "runs": [{"title": "Run 1", "type": "static", "queryPlans": [{"tcaseIds": ["abc"]}]}]}`

#### users

| Subcommand | Description                         | Required | Optional |
| ---------- | ----------------------------------- | -------- | -------- |
| `list`     | List all users in the organization. | —        | —        |

## Common Workflows

### 1. Upload JUnit results to an existing run

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/PRJ/run/23 ./test-results.xml
```

### 2. Create a run, upload results, and close it

```bash
# Create the run
qasphere api runs create \
  --project-code PRJ \
  --title "CI Build $BUILD_NUMBER" \
  --type static \
  --query-plans '[{"tcaseIds": ["abc123", "def456"]}]'

# Upload results (use the run-id from the create response)
qasphere api results batch-create \
  --project-code PRJ \
  --run-id 15 \
  --items '[{"tcaseId": "abc123", "status": "passed"}, {"tcaseId": "def456", "status": "failed", "comment": "Timeout"}]'

# Close the run
qasphere api runs close --project-code PRJ --run-id 15
```

### 3. List high-priority test cases and count them

```bash
# Count
qasphere api test-cases count --project-code PRJ --priorities high,medium

# List with pagination
qasphere api test-cases list --project-code PRJ --priorities high --limit 20 --page 1
```

### 4. Clone a run for regression testing

```bash
qasphere api runs clone \
  --project-code PRJ \
  --run-id 15 \
  --title "Regression v2.1.0" \
  --milestone-id 3
```

### 5. Bulk-create folder structure and test cases

```bash
# Create folders
qasphere api folders bulk-create \
  --project-code PRJ \
  --folders '[{"path": ["Authentication", "Login"]}, {"path": ["Authentication", "OAuth"]}]'

# Create a test case in a folder
qasphere api test-cases create \
  --project-code PRJ \
  --body '{"title": "Login with valid credentials", "type": "standalone", "folderId": 1, "priority": "high"}'
```

### 6. Create a test plan with multiple runs

```bash
qasphere api test-plans create \
  --project-code PRJ \
  --body @test-plan.json
```

Where `test-plan.json`:

```json
{
  "title": "Release 2.1 Plan",
  "runs": [
    {
      "title": "Smoke Tests",
      "type": "static",
      "queryPlans": [{ "tagIds": [1] }]
    },
    {
      "title": "Full Regression",
      "type": "static_struct",
      "queryPlans": [{ "priorities": ["high", "medium"] }]
    }
  ]
}
```

## Important Notes

- All `api` commands output valid JSON to stdout. Parse with `jq` or your language's JSON parser.
- Errors are printed to stderr with a non-zero exit code. Use `--verbose` for stack traces.
- JSON arguments (`--body`, `--query-plans`, `--items`, `--folders`, `--statuses`, `--links`) accept `@filename` to read from a file relative to the current directory instead of inline JSON.
- Use `--force` on upload commands to continue past invalid test cases or missing attachments.
- The `--include` option on list commands (e.g., `--include tcaseCount`) adds extra fields to the response.
- Run `qasphere api <resource> <action> --help` for full option details and examples.
