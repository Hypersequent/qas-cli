# QAS CLI

## Description

The QAS CLI tool can upload test case results from a JUnit XML file by matching the testsuite name and testcase name to QASphere's project folder and testcase respectively.

## Installation

To get started with this app, clone the repository and install the necessary dependencies.

```bash
git clone https://github.com/Hypersequent/qas-cli.git
cd qas-cli
npm install
```

## Command: `junit-upload`

### Options

- `-s, --subdomain` - URL subdomain (string)
- `-z, --zone` - URL zone (string)
- `-p, --project` - Project code (string) (required)
- `-r, --run` - Run ID (number) (required)
- `-t, --token` - API token (string)
- `--url` - Instance URL (string)
- `--attachments` - Try to detect any attachments and upload it with the test result (boolean)
- `--force` - Ignore API request errors, invalid test cases, or attachments (boolean)
- `-h, --help` - Show help (boolean)

### Examples

1. Upload JUnit XML file to `https://qas.eu1.qasphere.com/project/P1/run/23`
`$ node ./build/bin/qasphere.js junit-upload -d qas -z eu1 -p P1 -r 23 -t API_TOKEN ./path/to/junit.xml`

2. To upload JUnit XML file to `https://qas.eu1.qasphere.com/project/P1/run/23`
`$ node ./build/bin/qasphere.js junit-upload --url qas.eu1.hpsq.io -p P1 -r 23 -t API_TOKEN  ./path/to/junit.xml`

## How to Test

1. Build the code with `npm run build`.

2. Create a project with test cases 
3. Get a JUnit XML file. If you want to test the test cases from the CSV file above, use the JUnit XML file generated from [this repository](https://github.com/Hypersequent/bistrot-e2e).

4. Run the CLI with: `node ./build/bin/qasphere.js junit-upload ./results.xml --url YOUR_DOMAN.qasphere.com -p PROJECT_CODE -r RUN_ID -t API_TOKEN`
5. You may pass the `-h` flag to show help:
`node ./build/bin/qasphere junit-upload -h`
