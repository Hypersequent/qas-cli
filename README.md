# QAS CLI

[![npm version](https://img.shields.io/npm/v/qas-cli.svg)](https://www.npmjs.com/package/qas-cli)
[![license](https://img.shields.io/npm/l/qas-cli)](https://github.com/Hypersequent/qas-cli/blob/main/LICENSE)
[![CI](https://github.com/Hypersequent/qas-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Hypersequent/qas-cli/actions/workflows/ci.yml)

## Description

The QAS CLI is a command-line tool for submitting your test automation results to [QA Sphere](https://qasphere.com/). It provides the most efficient way to collect and report test results from your test automation workflow, CI/CD pipeline, and build servers.

The tool can upload test case results from JUnit XML and Playwright JSON files to QA Sphere test runs by matching test case names (mentions of special markers) to QA Sphere's test cases.

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

## Environment

The CLI requires the following variables to be defined:

- `QAS_TOKEN` - QA Sphere API token
- `QAS_URL` - Base URL of your QA Sphere instance (e.g., https://qas.eu2.qasphere.com)

These variables could be defined:
- as environment variables
- in .env of a current working directory
- in a special `.qaspherecli` configuration file in your project directory (or any parent directory)

Example: .qaspherecli
```sh
# .qaspherecli
QAS_TOKEN=your_token
QAS_URL=https://qas.eu1.qasphere.com

# Example with real values:
# QAS_TOKEN=qas.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
# QAS_URL=https://qas.eu1.qasphere.com
```


## Commands: `junit-upload`, `playwright-json-upload`

The `junit-upload` and `playwright-json-upload` commands upload test results from JUnit XML and Playwright JSON reports to QA Sphere respectively. Both commands can either create a new test run within a QA Sphere project or upload results to an existing run, and they share the same set of options.

### Options

- `-r, --run-url` - Optional URL of an existing run for uploading results (a new run is created if not specified)
- `--run-name` - Optional name template for creating new test run when run url is not specified (supports `{env:VAR}`, `{YYYY}`, `{YY}`, `{MM}`, `{MMM}`, `{DD}`, `{HH}`, `{hh}`, `{mm}`, `{ss}`, `{AMPM}` placeholders). If not specified, `Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}` is used as default
- `--attachments` - Try to detect and upload any attachments with the test result
- `--force` - Ignore API request errors, invalid test cases, or attachments
- `--ignore-unmatched` - Suppress individual unmatched test messages, show summary only
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

1. Create a new test run with default name template (`Automated test run - {MMM} {DD}, {YYYY}, {hh}:{mm}:{ss} {AMPM}`) and upload results:
    ```bash
    qasphere junit-upload ./test-results.xml
    ```

2. Upload to an existing test run:
    ```bash
    qasphere junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml
    ```

3. Create a new test run with name template without any placeholders and upload results:
    ```bash
    qasphere junit-upload --run-name "v1.4.4-rc5" ./test-results.xml
    ```

4. Create a new test run with name template using environment variables and date placeholders and upload results:
    ```bash
    qasphere junit-upload --run-name "CI Build {env:BUILD_NUMBER} - {YYYY}-{MM}-{DD}" ./test-results.xml
    ```
    If `BUILD_NUMBER` environment variable is set to `v1.4.4-rc5` and today's date is January 1, 2025, the run would be named "CI Build v1.4.4-rc5 - 2025-01-01".

5. Create a new test run with name template using date/time placeholders and upload results:
    ```bash
    qasphere junit-upload --run-name "Nightly Tests {YYYY}/{MM}/{DD} {HH}:{mm}" ./test-results.xml
    ```
    If the current time is 10:34 PM on January 1, 2025, the run would be named "Nightly Tests 2025/01/01 22:34".

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

## Test Report Requirements

The QAS CLI requires test cases in your reports (JUnit XML or Playwright JSON) to reference corresponding test cases in QA Sphere. These references are used to map test results from your automation to the appropriate test cases in QA Sphere. If a report lacks these references or the referenced test case doesn't exist in QA Sphere, the tool will display an error message.

### JUnit XML

Test case names in JUnit XML reports must include a QA Sphere test case marker in the format `PROJECT-SEQUENCE`:

- **PROJECT** - Your QA Sphere project code
- **SEQUENCE** - Test case sequence number (minimum 3 digits, zero-padded if needed)

**Examples:**
- `PRJ-002: Login with valid credentials`
- `Login with invalid credentials: PRJ-1312`

**Note:** The project code in test names must exactly match your QA Sphere project code.

### Playwright JSON

Playwright JSON reports support two methods for referencing test cases (checked in order):

1. **Test Annotations (Recommended)** - Add a [test annotation](https://playwright.dev/docs/test-annotations#annotate-tests) with:
   - `type`: `"test case"` (case-insensitive)
   - `description`: Full QA Sphere test case URL

   ```typescript
   test('user login', {
     annotation: { type: 'test case', description: 'https://qas.eu1.qasphere.com/project/PRJ/tcase/123' }
   }, async ({ page }) => {
     // test code
   });
   ```

2. **Test Case Marker in Name** - Include the `PROJECT-SEQUENCE` marker in the test name (same format as JUnit XML)

## Development (for those who want to contribute to the tool)

1. Install and build: `npm install && npm run build && npm link`
2. Get test account at [qasphere.com](https://qasphere.com/) (includes demo project)
3. Configure `.qaspherecli` with credentials
4. Test with sample reports from [bistro-e2e](https://github.com/Hypersequent/bistro-e2e)

Tests: `npm test` (Vitest) and `cd mnode-test && ./docker-test.sh` (Node.js 18+ compatibility)

Publishing: Add `publish` label to PR for auto-release to NPM (maintainers only)
