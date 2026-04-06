# qas-cli: incorrect Playwright upload mapping to QA Sphere runs

## Summary

`qas-cli playwright-json-upload` can report a successful upload while mapping many Playwright results to the wrong QA Sphere test cases.

In the reproduced upload:

- Playwright run: `142` tests total, `140 passed`, `2 failed`
- CLI upload output: `Uploaded 139 test cases`
- QA Sphere run summary after upload: only `33 passed`, `1 failed`

Root cause:

- the uploader matches hyphenated markers with substring logic, so `QS1-10427` incorrectly matches `QS1-104`
- the Playwright parser only uses the first `test case` annotation and drops additional ones

## Repro

Using the Chromium Playwright JSON report from `tms-2` and uploading to existing run `QS1/run/53`:

- `139` results were considered matched
- but they collapsed onto only `34` unique run test cases

Observed collisions:

- `QS1-104` absorbed `58` results
- `QS1-103` absorbed `25`
- `QS1-106` absorbed `19`
- `QS1-105` absorbed `4`

This produced the exact run summary seen in QA Sphere: `33 passed / 1 failed`.

## Issues

### 1. Exact marker matching is broken

File:

- [src/utils/result-upload/MarkerParser.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/MarkerParser.ts#L152)

Current code:

- `name.toLowerCase().includes(hyphenated.toLowerCase())`

Problem:

- `QS1-10427` matches `QS1-104`
- `QS1-10775` matches `QS1-107`

Expected:

- hyphenated markers must match exactly with boundaries
- `QS1-104` must not match `QS1-10427`

### 2. Playwright multi-annotation support is incomplete

File:

- [src/utils/result-upload/playwrightJsonParser.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/playwrightJsonParser.ts#L106)

Problem:

- only the first QA Sphere `test case` annotation is used
- additional annotations on the same test are dropped

Evidence from the reproduced report:

- `138` tests had annotations
- `26` tests had multiple annotations
- examples included tests with `2`, `3`, `4`, `6`, `7`, `8`, and `10` QA Sphere references

Expected:

- one Playwright test with multiple QA Sphere annotations should fan out into multiple upload results, one per annotation

### 3. Upload success messaging is misleading

File:

- [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L31)

Problem:

- final message says `Uploaded 139 test cases`
- in reality those were `139` mapped result records targeting only `34` unique run test cases
- duplicate mapping collisions are not surfaced

Expected:

- output should distinguish:
  - number of source results
  - number of mapped results
  - number of unique target test cases
- uploader should warn or fail when many results collapse onto the same target case unexpectedly

## Acceptance Criteria

1. `nameMatchesTCase()` uses exact matching for hyphenated markers and no longer allows prefix collisions.
2. Playwright parsing supports multiple `test case` annotations by generating one upload result per referenced QA Sphere case.
3. Uploader output clearly reports mapped results vs unique target test cases.
4. Regression tests cover:
   - `QS1-104` vs `QS1-10427`
   - single vs multiple Playwright annotations
   - duplicate-mapping detection or reporting

## Notes

Three unmatched tests in the reproduced run were genuinely unlinked and are not part of this bug:

- `should show error for invalid credentials`
- `Complete smoke test of basic functionality`
- `should show no run cards for project with no assigned runs`

Full report:

- [QAS_CLI_ISSUES_REPORT.md](/Users/apple/Github/Hypersequent/qas-cli/QAS_CLI_ISSUES_REPORT.md)
