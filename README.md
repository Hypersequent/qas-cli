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

- The CLI requires following variables to be defined, absence of which will result in error:
  - `QAS_TOKEN` - QASphere API token
- These should either be `export`ed as environment variables while running the command or defined in a `.qaspherecli` configuration file in the directory where the command is being run or one of its parent directories.
- `.qaspherecli` follows the simple syntax of `.env` files:
  ```sh
  # Comment
  QAS_TOKEN=token
  QAS_TOKEN=token # comment
  export QAS_TOKEN=token
  ```

## Command: `junit-upload`

### Options

- `-r, --run-url` - URL of the Run (from QASphere) for uploading results, eg. https://qas.eu1.qasphere.com/project/P1/run/23 (string)
- `--attachments` - Try to detect any attachments and upload it with the test result (boolean)
- `--force` - Ignore API request errors, invalid test cases, or attachments (boolean)
- `-h, --help` - Show help (boolean)

### Examples

Make sure that the required variables, as mentioned in [Environment](#environment), are defined before running the commands.

1. Upload JUnit XML file to Run ID 23 of Project P1

```bash
qasphere junit-upload -r https://qas.eu1.qasphere.com/project/P1/run/23 ./path/to/junit.xml
```

2. To upload all (JUnit) XML files from the current directory to Run ID 23 of Project P1

```bash
qasphere junit-upload --run-url https://qas.eu1.qasphere.com/project/P1/run/23 ./*.xml


## Command: `new-junit-testrun`

### Description

The `new-junit-testrun` command creates a new test run or uploads results to an existing test run using JUnit XML files.

### Options

- `-p, --project` - URL of the project (from QASphere) for creating a new test run, eg. https://qas.eu1.qasphere.com/project/P1 (string)
- `-r, --run-url` - URL of the existing test run (from QASphere) for uploading results, eg. https://qas.eu1.qasphere.com/project/P1/run/23 (string)
- `--attachments` - Try to detect any attachments and upload them with the test result (boolean)
- `--force` - Ignore API request errors, invalid test cases, or attachments (boolean)
- `-h, --help` - Show help (boolean)

### Examples

Make sure that the required variables, as mentioned in [Environment](#environment), are defined before running the commands.

1. Create a new test run in Project P1 using a JUnit XML file:

```bash
qasphere new-junit-testrun --project https://qas.eu1.qasphere.com/project/P1 ./test-results.xml
```

2. Upload JUnit XML files to an existing test run:

```bash
qasphere new-junit-testrun --run-url https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml
```

3. Force upload results with attachments to an existing test run:

```bash
qasphere new-junit-testrun -r https://qas.eu1.qasphere.com/project/P1/run/23 ./test-results.xml --force --attachments
```

## JUnit XML File Requirements

The qas-cli tool requires JUnit XML files to have test case names that match the test case codes on QASphere. If your XML file doesn't contain any matching test cases, the tool will display an error message.

### Test Case Naming Convention

Test case names in the XML report should contain QA Sphere test case reference (PROJECT-SEQUENCE).
This reference is used to match test cases in the XML report with test cases in QA Sphere.

- **PROJECT** is your QASphere project code
- **SEQUENCE** is at least three-digit test case sequence number in QASphere test case URL.

For example:
- **PRJ-312: Login with valid credentials**
- **Login with valid credentials: PRJ-312**


## How to Test

1. Build the code with `npm run build`.
2. Create a project with test cases using a local QASphere build or by registering on [qasphere.com](https://qasphere.com/).
3. Get a JUnit XML file. If you want to test the test cases from the CSV file above, use the JUnit XML file generated from [this repository](https://github.com/Hypersequent/bistrot-e2e).
4. Define required variables as mentioned in [Environment](#environment).
5. Run the CLI with the following commands:
   - For uploading to an existing run: `qasphere junit-upload -r QAS_URL/project/PROJECT_CODE/run/RUN_ID ./JUnit.xml`
   - For creating a new test run: `qasphere new-junit-testrun -p QAS_URL/project/PROJECT_CODE ./JUnit.xml`
6. If you get permission errors, retry after running: `chmod +x ./build/bin/qasphere.js`.
7. You may pass the `-h` flag to show help: `node ./build/bin/qasphere new-junit-testrun -h`.
