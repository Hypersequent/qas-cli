---
name: qas-cli
description: CLI tool for managing QA Sphere test cases, runs, and results. Upload test automation results and access the full QA Sphere public API from the command line.
metadata:
  author: Hypersequent
  version: '0.5.0'
---

# qas-cli

CLI for [QA Sphere](https://qasphere.com/) — upload test automation results and access the full QA Sphere API from the command line.

## Prerequisites

- **Node.js** 18.0.0+
- **`QAS_TOKEN`** — QA Sphere API token ([how to generate](https://docs.qasphere.com/api/authentication))
- **`QAS_URL`** — Base URL of your QA Sphere instance (e.g., `https://qas.eu2.qasphere.com`)

Set via environment variables, `.env`, or `.qaspherecli` file.

## Upload Commands

Upload test results to QA Sphere test runs. All three share the same options.

```bash
qasphere junit-upload [options] <files..>
qasphere playwright-json-upload [options] <files..>
qasphere allure-upload [options] <directories..>
```

Key options: `-r, --run-url`, `--project-code`, `--run-name`, `--create-tcases`, `--attachments`, `--force`, `--ignore-unmatched`

### Test Case Matching

Results are matched to QA Sphere test cases via markers:

- **Hyphenated** (all formats): `PRJ-123` anywhere in test name
- **Underscore** (JUnit only): `test_prj123_login` — name must start with `test`
- **CamelCase** (JUnit only): `TestPrj123Login` — name must start with `Test`
- **Playwright annotations**: `{ type: "test case", description: "<qasphere-url>" }`
- **Allure TMS links**: `{ type: "tms", url: "<qasphere-url>" }`

## API Command Tree

```
qasphere api <resource> <action> [options]
```

All commands output JSON to stdout, errors to stderr.

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
│   └── tcases
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

Each subcommand accepts `-h` option to show all available subcommands if any.
Use `qasphere api <resource> <action> -h` to see the full command signature, all options, examples, and online documentation link.
When fetching the online documentation, the link URL can be appended with `.md` to view it in markdown. Use the markdown version first before falling back to the original URL if the endpoint returned a >= 400 status.

## Common Workflows

### Upload JUnit results to an existing run

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/PRJ/run/23 ./test-results.xml
```

### Create a run, upload results, and close it

```bash
qasphere api runs create \
  --project-code PRJ --title "CI Build $BUILD_NUMBER" \
  --type static --query-plans '[{"tcaseIds": ["abc123", "def456"]}]'

qasphere api results batch-create \
  --project-code PRJ --run-id 15 \
  --items '[{"tcaseId": "abc123", "status": "passed"}, {"tcaseId": "def456", "status": "failed", "comment": "Timeout"}]'

qasphere api runs close --project-code PRJ --run-id 15
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

## Important Notes

- JSON args (`--body`, `--query-plans`, `--items`, `--folders`, `--statuses`, `--links`) accepts raw JSON strings or a file path `@path/to/file` to read from file relative to the current working directory.
- Use `--force` on upload commands to continue past invalid test cases or missing attachments.
- Use `--verbose` for stack traces on errors.
