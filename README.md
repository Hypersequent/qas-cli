# QAS CLI

[![npm version](https://img.shields.io/npm/v/qas-cli.svg)](https://www.npmjs.com/package/qas-cli)
[![license](https://img.shields.io/npm/l/qas-cli)](https://github.com/Hypersequent/qas-cli/blob/main/LICENSE)
[![CI](https://github.com/Hypersequent/qas-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Hypersequent/qas-cli/actions/workflows/ci.yml)

## Table of Contents

- [Description](#description)
- [Installation](#installation)
  - [Requirements](#requirements)
  - [Via NPX](#via-npx)
  - [Via NPM](#via-npm)
- [Shell Completion](#shell-completion)
- [Authentication](#authentication)
  - [Other auth commands](#other-auth-commands)
  - [Credential resolution order](#credential-resolution-order)
  - [Manual configuration](#manual-configuration)
- [Command: `api`](#command-api)
  - [API Command Tree](#api-command-tree)
- [Commands: `junit-upload`, `playwright-json-upload`, `allure-upload`](#commands-junit-upload-playwright-json-upload-allure-upload)
  - [Options](#options)
  - [Run Name Template Placeholders](#run-name-template-placeholders)
  - [Usage Examples](#usage-examples)
- [Test Report Requirements](#test-report-requirements)
  - [JUnit XML](#junit-xml)
  - [Playwright JSON](#playwright-json)
  - [Allure](#allure)
  - [Run-Level Logs](#run-level-logs)
- [AI Agent Skill](#ai-agent-skill)
- [Development](#development-for-those-who-want-to-contribute-to-the-tool)

## Description

The QAS CLI is a command-line tool for submitting your test automation results to [QA Sphere](https://qasphere.com/). It provides the most efficient way to collect and report test results from your test automation workflow, CI/CD pipeline, and build servers.

The tool can upload test case results from JUnit XML files, Playwright JSON files, and Allure result directories to QA Sphere test runs by matching test case references to QA Sphere test cases. It also automatically detects global or suite-level failures (e.g., setup/teardown errors) and uploads them as run-level logs.

## Installation

### Requirements

Node.js version 18.0.0 or higher.

### Via NPX

Simply run `npx qas-cli`. On first use, you'll need to agree to download the package. You can use `npx qas-cli` in all contexts instead of the `qasphere` command.

Verify installation: `npx qas-cli --version`

**Note:** npx caches packages. To ensure latest version, clear cache with `npx clear-npx-cache`.

### Via NPM

```bash
npm install -g qas-cli
```

Verify installation: `qasphere --version`

**Update:** Run `npm update -g qas-cli` to get the latest version.

## Shell Completion

The CLI supports shell completion for commands and options. To enable it, append the completion script to your shell profile:

**Zsh:**

```bash
qasphere completion >> ~/.zshrc
```

**Bash:**

```bash
qasphere completion >> ~/.bashrc
```

Then restart your shell or source the profile (e.g., `source ~/.zshrc`). After that, pressing `Tab` will autocomplete commands and options.

## Authentication

The recommended way to authenticate is using the interactive login command:

```bash
qasphere auth login
```

This opens your browser to complete authentication and securely stores your credentials in the system keyring. If a keyring is not available, credentials are stored in `~/.config/qasphere/credentials.json` with restricted file permissions.

### Other auth commands

```bash
qasphere auth status    # Show current authentication status
qasphere auth logout    # Clear stored credentials
```

### Credential resolution order

The CLI resolves credentials in the following order (first match wins):

1. `QAS_TOKEN` and `QAS_URL` environment variables
2. `.env` file in the current working directory
3. System keyring (set by `qasphere auth login`)
4. `~/.config/qasphere/credentials.json` (fallback when keyring is unavailable)
5. `.qaspherecli` file in the current directory or any parent directory

### Manual configuration

Instead of using `auth login`, you can manually set the required variables:

- `QAS_TOKEN` - QA Sphere API token (see [docs](https://docs.qasphere.com/api/authentication) if you need help generating one)
- `QAS_URL` - Base URL of your QA Sphere instance (e.g., `https://qas.eu2.qasphere.com`)

These variables can be defined as environment variables, in a `.env` file, or in a `.qaspherecli` configuration file:

```sh
# .qaspherecli
QAS_TOKEN=your_token
QAS_URL=https://qas.eu1.qasphere.com
```

## Command: `api`

The `api` command provides direct access to the QA Sphere public API from the command line. Outputting JSON to stdout for easy scripting and piping.

### API Command Tree

```
qasphere api <resource> <action> [options]
```

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

## Commands: `junit-upload`, `playwright-json-upload`, `allure-upload`

The `junit-upload`, `playwright-json-upload`, and `allure-upload` commands upload test results to QA Sphere.

There are two modes for uploading results using the commands:

1. Upload to an existing test run by specifying its URL via `--run-url` flag
2. Create a new test run and upload results to it (when `--run-url` flag is not specified)

### Options

- `<files..>` / `<directories..>` - Input paths. Use report files for `junit-upload` and `playwright-json-upload`, and Allure results directories for `allure-upload`
- `-r`/`--run-url` - Upload results to an existing test run
- `--project-code`, `--run-name`, `--create-tcases` - Create a new test run and upload results to it
  - `--project-code` - Project code for creating new test run. It can also be auto detected from test case markers in the results, but this is not fully reliable, so it is recommended to specify the project code explicitly
  - `--run-name` - Optional name template for creating new test run. It supports `{env:VAR}`, `{YYYY}`, `{YY}`, `{MM}`, `{MMM}`, `{DD}`, `{HH}`, `{hh}`, `{mm}`, `{ss}`, `{AMPM}` placeholders (default: `Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}`)
  - `--create-tcases` - Automatically create test cases in QA Sphere for results that don't have valid test case markers. A mapping file (`qasphere-automapping-YYYYMMDD-HHmmss.txt`) is generated showing the sequence numbers assigned to each new test case (default: `false`)
- `--attachments` - Try to detect and upload any attachments with the test result
- `--force` - Ignore API request errors, invalid or duplicate test case mappings, or attachments
- `--ignore-unmatched` - Suppress individual unmatched test messages, show summary only
- `--skip-report-stdout` - Control when to skip stdout blocks from test report (choices: `on-success`, `never`; default: `never`)
- `--skip-report-stderr` - Control when to skip stderr blocks from test report (choices: `on-success`, `never`; default: `never`)
- `-h, --help` - Show command help

### Run Name Template Placeholders

The `--run-name` option supports the following placeholders:

- `{env:VARIABLE_NAME}` - Environment variables (e.g., `{env:BUILD_NUMBER}`, `{env:CI_COMMIT_SHA}`)
- `{YYYY}` - 4-digit year
- `{YY}` - 2-digit year
- `{MMM}` - 3-letter month (e.g., Jan, Feb, Mar)
- `{MM}` - 2-digit month
- `{DD}` - 2-digit day
- `{HH}` - 2-digit hour in 24-hour format
- `{hh}` - 2-digit hour in 12-hour format
- `{mm}` - 2-digit minute
- `{ss}` - 2-digit second

**Note:** The `--run-name` option is only used when creating new test runs (i.e., when `--run-url` is not specified).

### Usage Examples

Ensure the required environment variables are defined before running these commands.

**Note:** The following examples use `junit-upload`, but you can replace it with `playwright-json-upload` and adjust the file extension from `.xml` to `.json` to upload Playwright JSON reports instead.

1. Upload to an existing test run:

   ```bash
   qasphere junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml
   ```

2. Create a new test run with default name template and upload results:

   ```bash
   qasphere junit-upload ./test-results.xml
   ```

   Project code is detected from test case markers in the results.

3. Create a new test run with name template without any placeholders and upload results:

   ```bash
   qasphere junit-upload --project-code P1 --run-name "v1.4.4-rc5" ./test-results.xml
   ```

4. Create a new test run with name template using environment variables and date placeholders and upload results:

   ```bash
   qasphere junit-upload --project-code P1 --run-name "CI Build {env:BUILD_NUMBER} - {YYYY}-{MM}-{DD}" ./test-results.xml
   ```

   If `BUILD_NUMBER` environment variable is set to `v1.4.4-rc5` and today's date is January 1, 2025, the run would be named "CI Build v1.4.4-rc5 - 2025-01-01".

5. Create a new test run with name template using date/time placeholders and create test cases for results without valid markers and upload results:

   ```bash
   qasphere junit-upload --project-code P1 --run-name "Nightly Tests {YYYY}/{MM}/{DD} {HH}:{mm}" --create-tcases ./test-results.xml
   ```

   If the current time is 10:34 PM on January 1, 2025, the run would be named "Nightly Tests 2025/01/01 22:34". This also creates new test cases in QA Sphere for any results that doesn't have a valid test case marker. A mapping file (`qasphere-automapping-YYYYMMDD-HHmmss.txt`) is generated showing the sequence numbers assigned to each newly created test case. Update your test cases to include the markers in the name, for future uploads.

6. Upload results with attachments:

   ```bash
   qasphere junit-upload --attachments ./test1.xml
   ```

7. Force upload even with missing test cases or attachments:

   ```bash
   qasphere junit-upload --force ./test-results.xml
   ```

8. Suppress unmatched test messages (useful during gradual test case linking):

   ```bash
   qasphere junit-upload --ignore-unmatched ./test-results.xml
   ```

   This will show only a summary like "Skipped 5 unmatched tests" instead of individual error messages for each unmatched test.

9. Skip stdout for passed tests to reduce result payload size:

   ```bash
   qasphere junit-upload --skip-report-stdout on-success ./test-results.xml
   ```

   This will exclude stdout from passed tests while still including it for failed, blocked, or skipped tests.

10. Skip both stdout and stderr for passed tests:

    ```bash
    qasphere junit-upload --skip-report-stdout on-success --skip-report-stderr on-success ./test-results.xml
    ```

    This is useful when you have verbose logging in tests but only want to see output for failures.

11. Upload Allure results from a directory:

    ```bash
    qasphere allure-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./allure-results
    ```

12. Continue Allure upload when some `*-result.json` files are malformed (skip invalid files):

    ```bash
    qasphere allure-upload --force -r https://qas.eu1.qasphere.com/project/P1/run/23 ./allure-results
    ```

## Test Report Requirements

The QAS CLI maps test results from your reports (JUnit XML, Playwright JSON, or Allure) to corresponding test cases in QA Sphere. If a test result lacks a valid marker/reference, or multiple results resolve to the same run test case, the CLI will display an error unless you use `--create-tcases` to automatically create test cases, or `--ignore-unmatched`/`--force` to bypass the mapping issue.

### JUnit XML

Test case names in JUnit XML reports must include a QA Sphere test case marker. The following marker formats are supported (checked in order):

#### 1. Hyphenated Marker (all languages)

Format: `PROJECT-SEQUENCE` where **PROJECT** is your QA Sphere project code and **SEQUENCE** is the test case sequence number (minimum 3 digits, zero-padded if needed). The marker can appear anywhere in the test name and is matched case-insensitively.

**Examples:**

- `PRJ-002: Login with valid credentials`
- `Login with invalid credentials: PRJ-1312`

#### 2. Underscore-Separated Hyphenless Marker (pytest, Go, Rust, etc.)

For languages where test names are function identifiers and hyphens are not allowed, the CLI supports hyphenless markers separated by underscores. The test name must start with `test` (case-insensitive).

**Examples (pytest):**

- `test_prj002_login_with_valid_credentials`
- `test_login_with_invalid_credentials_prj1312`

#### 3. CamelCase Hyphenless Marker (Go, Java)

For CamelCase test function names, the CLI detects markers at the start (immediately after the `Test` prefix) or at the end of the name. The test name must start with `Test` (case-insensitive).

**Examples (Go):**

- `TestPrj002LoginWithValidCredentials` (marker at start)
- `TestLoginWithValidCredentialsPrj1312` (marker at end)

**Note:** Hyphenless matching (formats 2 and 3) is only available for `junit-upload`. For `playwright-json-upload`, only the hyphenated format is supported (or test annotations, see below).

### Playwright JSON

Playwright JSON reports support two methods for referencing test cases (checked in order):

1. **Test Annotations (Recommended)** - Add a [test annotation](https://playwright.dev/docs/test-annotations#annotate-tests) with:
   - `type`: `"test case"` (case-insensitive)
   - `description`: Full QA Sphere test case URL

   ```typescript
   test(
     'user login',
     {
       annotation: {
         type: 'test case',
         description: 'https://qas.eu1.qasphere.com/project/PRJ/tcase/123',
       },
     },
     async ({ page }) => {
       // test code
     }
   )
   ```

2. **Hyphenated Marker in Name** - Include the `PROJECT-SEQUENCE` marker in the test name (same format as JUnit XML format 1). Hyphenless markers are **not** supported for Playwright JSON

### Allure

Allure results use one `*-result.json` file per test in a results directory. `allure-upload` matches test cases using:

1. **TMS links (Recommended)** - `links[]` entries with:
   - `type`: `"tms"`
   - `url`: QA Sphere test case URL, e.g. `https://qas.eu1.qasphere.com/project/PRJ/tcase/123`
2. **TMS link name fallback** - If `url` is not a QA Sphere URL, a marker in `links[].name` is used (for example `PRJ-123`)
3. **Test case marker in name** - Marker in `name` field (same `PROJECT-SEQUENCE` format as JUnit XML)

Only Allure JSON result files (`*-result.json`) are supported. Legacy Allure 1 XML files are ignored.

### Run-Level Logs

The CLI automatically detects global or suite-level failures and uploads them as run-level logs to QA Sphere. These failures are typically caused by setup/teardown issues that aren't tied to specific test cases.

- **JUnit XML**: Suite-level `<system-err>` elements and empty-name `<testcase>` entries with `<error>` or `<failure>` (synthetic entries from setup/teardown failures, e.g., Maven Surefire) are extracted as run-level logs.
- **Playwright JSON**: Top-level `errors` array entries (global setup/teardown failures) are extracted as run-level logs.
- **Allure**: Failed or broken `befores`/`afters` fixtures in `*-container.json` files (e.g., session/module-level setup/teardown failures from pytest) are extracted as run-level logs.

## AI Agent Skill

qas-cli includes a [SKILL.md](./SKILL.md) file that enables AI coding agents (e.g., Claude Code, Cursor) to use the CLI effectively. To add this skill to your agent:

```bash
npx skills add Hypersequent/qas-cli
```

The skill provides the agent with full documentation of the CLI commands, options, and conventions. See [skills](https://github.com/vercel-labs/skills) for more details.

## Development (for those who want to contribute to the tool)

1. Install and build: `npm install && npm run build && npm link`
2. Get test account at [qasphere.com](https://qasphere.com/) (includes demo project)
3. Configure `.qaspherecli` with credentials
4. Test with sample reports from [bistro-e2e](https://github.com/Hypersequent/bistro-e2e)

Tests: `npm test` (Vitest) and `cd mnode-test && ./docker-test.sh` (Node.js 18+ compatibility)
