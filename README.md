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
2. Download, build, and link repositiory:

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

## Command: `junit-upload`

### Options

- `-t, --token` - API token (string) - Can be generated under QASphere **Settings>API keys**
- `-r, --run-url` - URL of the Run (from QASphere) for uploading results, eg. https://qas.eu1.qasphere.com/project/P1/run/23 (string)
- `--attachments` - Try to detect any attachments and upload it with the test result (boolean)
- `--force` - Ignore API request errors, invalid test cases, or attachments (boolean)
- `-h, --help` - Show help (boolean)

### Examples

1. Upload JUnit XML file to Run ID 23 of Project P1

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 -t API_TOKEN ./path/to/junit.xml
```

2. To upload all (JUnit) XML files from the current directory to Run ID 23 of Project P1

```bash
qasphere junit-upload --run-url https://qas.eu1.qasphere.com/project/P1/run/23 --token API_TOKEN ./*.xml
```

## How to Test

1. Build the code with `npm run build`.
2. Create a project with test cases using local QASphere build or by registering on [qasphere.com](https://qasphere.com/)
3. Get a JUnit XML file. If you want to test the test cases from the CSV file above, use the JUnit XML file generated from [this repository](https://github.com/Hypersequent/bistrot-e2e).
4. Run the CLI with: `node ./build/bin/qasphere.js junit-upload -r QAS_URL/project/PROJECT_CODE/run/RUN_ID -t API_TOKEN ./JUnit.xml`. If you get permission errors, please retry after running: `chmod +x ./build/bin/qasphere.js`
5. You may pass the `-h` flag to show help: `node ./build/bin/qasphere junit-upload -h`
