# QAS CLI

## Description

The QAS CLI is a command line tool to submit your test automation results to [QA Sphere](https://qasphere.com/). It is the best way to collect and report your test results from your test automation workflow, CI/CD pipeline and build servers.

The QAS CLI tool can upload test case results from a JUnit XML file to QASphere test run by matching the testsuite name and test case name to QA Sphere's project folder and test case respectively.

## Installation

### Requirements

Node.js version 18.0.0 or higher.

### Via NPM

```bash
npm install -g qas-cli
```

### Via source code

1. Install [NodeJS](https://nodejs.org/en/download/package-manager/current)
2. Download, build, and link repository:

```bash
git clone https://github.com/Hypersequent/qas-cli.git
cd qas-cli
npm install
npm run build
npm link
```

3. Verify installation

```bash
qasphere --version
```

## Environment

The CLI requires the following variables to be defined:

- `QAS_TOKEN` - QASphere API token
- `QAS_URL` - Base URL of your QASphere instance (e.g., https://qas.eu1.qasphere.com)

These variables should be defined in a `.qaspherecli` configuration file in your project directory (or any parent directory). Create the file with:

```sh
# .qaspherecli
QAS_TOKEN=your_token
QAS_URL=https://qas.eu1.qasphere.com

# Example with real values:
# QAS_TOKEN=tst0000001.1CKCEtest_JYyckc3zYtest.dhhjYY3BYEoQH41e62itest
# QAS_URL=https://qas.eu1.qasphere.com
```

Alternatively, you can export them as environment variables:

```bash
export QAS_TOKEN=your_token
export QAS_URL=https://qas.eu1.qasphere.com
```

## Command: `junit-upload`

The `junit-upload` command automatically creates a new test run within a QA Sphere project from your JUnit XML files or uploads to an existing run.

### Options

- `-r, --run-url` - Optional URL of an existing Run for uploading results (string)
- `--attachments` - Try to detect any attachments and upload it with the test result (boolean)
- `--force` - Ignore API request errors, invalid test cases, or attachments (boolean)
- `-h, --help` - Show help (boolean)

### Examples

Make sure the required environment variables are defined before running these commands.

1. Create a new test run and upload results (project code detected from test names):

```bash
qasphere junit-upload ./test-results.xml
```

2. Upload to an existing test run:

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml
```

3. Upload multiple files with attachments to a new test run:

```bash
qasphere junit-upload --attachments ./test1.xml ./test2.xml
```

4. Force upload even with missing test cases:

```bash
qasphere junit-upload --force ./test-results.xml
```

## JUnit XML File Requirements

The qas-cli tool requires JUnit XML files to have test case names that match the test case codes on QASphere. If your XML file doesn't contain any matching test cases, the tool will display an error message.

### Test Case Naming Convention

Test case names in the XML report should contain QA Sphere test case reference (PROJECT-SEQUENCE).
This reference is used to match test cases in the XML report with test cases in QA Sphere.

- **PROJECT** is your QASphere project code
- **SEQUENCE** is at least three-digit test case sequence number

For example:

- **PRJ-312: Login with valid credentials**
- **Login with valid credentials: PRJ-312**

The project code in your test names must match the project code in QASphere.

## How to Test

1. Build the code with `npm run build`.
2. Create a project with test cases using a local QASphere build or by registering on [qasphere.com](https://qasphere.com/).
3. Get a JUnit XML file. If you want to test the test cases from the CSV file above, use the JUnit XML file generated from [this repository](https://github.com/Hypersequent/bistrot-e2e).
4. Create a `.qaspherecli` file with your QASphere configuration.
5. Run the CLI with: `qasphere junit-upload ./test-results.xml`
6. If you get permission errors, retry after running: `chmod +x ./build/bin/qasphere.js`
7. You may pass the `-h` flag to show help: `qasphere junit-upload -h`
