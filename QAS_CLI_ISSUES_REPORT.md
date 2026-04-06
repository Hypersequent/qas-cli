# qas-cli Issue Report

Date: 2026-03-20

## Scope

This report covers issues found while uploading the Chromium Playwright e2e run from `tms-2` into an existing QA Sphere run with `qas-cli playwright-json-upload`.

Observed local run summary:

- `142` Playwright tests total
- `140 passed`
- `2 failed`
- `3` tests had no QA Sphere marker/annotation and were intentionally unmatched

Observed uploader output:

- first upload failed on the 3 unmatched tests
- retry with `--ignore-unmatched` reported `Uploaded 139 test cases`

Observed QA Sphere run summary after upload:

- `33 passed`
- `1 failed`
- `762 open`

That mismatch is explained by the issues below.

## Findings

### 1. Critical: `nameMatchesTCase()` uses substring matching for hyphenated markers

Files:

- [src/utils/result-upload/MarkerParser.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/MarkerParser.ts#L152)
- [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L322)

Current behavior:

- `nameMatchesTCase()` builds a canonical marker like `QS1-104`
- it then checks `name.toLowerCase().includes(hyphenated.toLowerCase())`

That is incorrect for hyphenated markers because:

- `QS1-10427` incorrectly matches `QS1-104`
- `QS1-10775` incorrectly matches `QS1-107`
- any shorter prefix test case already present in the run can absorb unrelated longer markers

### Evidence

Replaying the current uploader logic against the generated Playwright JSON and the existing run's test cases produced:

- `142` total Playwright results
- `139` considered matched
- only `34` unique run test cases targeted

The matched `seq` set was:

- `8, 13, 15, 17, 19, 21, 32, 33, 34, 35, 36, 37, 38, 39, 103, 104, 105, 106, 107, 207, 208, 209, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219, 223, 365`

The worst collisions were:

- `QS1-104` matched `58` uploaded results
- `QS1-103` matched `25`
- `QS1-106` matched `19`
- `QS1-105` matched `4`

This exactly explains why the run summary only showed `33 passed / 1 failed`: the results were collapsed onto a small set of prefix case IDs already present in the run.

### Impact

- Results are uploaded to the wrong test cases
- Existing run summaries become misleading
- Failures can be assigned to unrelated test cases
- The CLI can appear to succeed while corrupting run-level reporting

### Suggested fix

Replace substring matching with exact marker matching using boundaries.

Expected semantics:

- `QS1-104` should match only `QS1-104`
- it must not match `QS1-10427`

Reasonable implementation options:

- use a regex with boundaries around the full marker
- or parse markers from the result name first, then compare normalized marker values exactly

Suggested tests:

- `nameMatchesTCase('QS1-10427: some test', 'QS1', 104)` should be `false`
- `nameMatchesTCase('QS1-104: some test', 'QS1', 104)` should be `true`
- `nameMatchesTCase('some test (QS1-10427)', 'QS1', 10427)` should be `true`
- `nameMatchesTCase('some test (QS1-10427)', 'QS1', 104)` should be `false`

### 2. High: Playwright parser only uses the first `test case` annotation

Files:

- [src/utils/result-upload/playwrightJsonParser.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/playwrightJsonParser.ts#L106)
- [src/utils/result-upload/playwrightJsonParser.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/playwrightJsonParser.ts#L159)

Current behavior:

- `getTCaseMarkerFromAnnotations()` returns only a single marker
- `parsePlaywrightJson()` prefixes that one marker into the result name
- any additional QA Sphere annotations on the same Playwright test are discarded

### Evidence

In the generated Playwright JSON:

- `138` tests had at least one annotation
- `26` tests had multiple QA Sphere annotations

Examples:

- one test had `7` annotations: `QS1-10427`, `QS1-10428`, `QS1-10429`, `QS1-10430`, `QS1-10668`, `QS1-10669`, `QS1-10670`
- another had `8` annotations: `QS1-10591` through `QS1-10598`
- another had `6` annotations: `QS1-10775` through `QS1-10780`

Today only the first annotation is used, so the rest are lost before matching even starts.

### Impact

- Multi-case Playwright tests cannot upload all referenced QA Sphere cases
- Uploaded coverage is incomplete even if marker matching is fixed
- Complex scenario tests appear under only one case instead of all declared cases

### Suggested fix

Change the Playwright parser to return multiple `TestCaseResult` entries when a test has multiple QA Sphere annotations.

Expected behavior:

- one Playwright test with `N` QA Sphere annotations should fan out into `N` result entries
- each entry should carry the same status, attachments, comment, and timing
- each entry should map to its own QA Sphere test case

Suggested tests:

- single annotation still produces one result
- multiple annotations produce multiple results
- annotation order does not drop later markers
- annotations should take precedence over name markers when both exist

### 3. Medium: uploader messaging is misleading and hides destructive fan-in

Files:

- [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L31)
- [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L272)
- [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L322)

Current behavior:

- uploader logs `Uploaded ${mappedResults.length} test cases`
- in this repro that message was `Uploaded 139 test cases`
- but those `139` mapped results collapsed onto only `34` unique run test cases because of issue 1

The message is misleading even aside from the bug:

- it is counting uploaded result records, not distinct test cases
- it does not report duplicate mappings
- it does not warn when many source results fan into a small set of target test cases

### Impact

- false confidence after upload
- hard to spot mapping corruption
- user sees success in CLI but wrong numbers in QA Sphere UI

### Suggested fix

Improve diagnostics before and after upload:

- log both `mapped results` and `unique target test cases`
- if multiple source results map to the same run test case, warn or fail unless explicitly allowed
- change final message to `Uploaded X results to Y test cases`

Also consider validating API responses more strictly:

- compare requested batch size with returned ID count
- surface partial-acceptance conditions clearly

Suggested tests:

- duplicate mappings should be visible in output
- final message should distinguish results vs distinct cases

## Not Bugs

These were investigated and should not be treated as defects:

- Uploading to an existing run only maps against test cases already present in that run.
  This is by design in [src/utils/result-upload/ResultUploader.ts](/Users/apple/Github/Hypersequent/qas-cli/src/utils/result-upload/ResultUploader.ts#L32).

- The 3 unmatched Playwright tests in this run were genuinely unlinked:
  - `should show error for invalid credentials`
  - `Complete smoke test of basic functionality`
  - `should show no run cards for project with no assigned runs`

## Recommended Fix Order

1. Fix exact marker matching in `nameMatchesTCase()`
2. Add regression tests for prefix collisions
3. Fix Playwright multi-annotation fan-out
4. Add regression tests for multi-annotation parsing and upload mapping
5. Improve uploader diagnostics and final reporting

## Minimal Repro Summary

Using the generated Playwright JSON from the Chromium run:

- the current parser/uploader mapped `139` results
- but only `34` unique run test cases were targeted
- most high-numbered `QS1-*` markers were incorrectly absorbed by short prefix IDs like `QS1-103`, `QS1-104`, `QS1-105`, `QS1-106`, `QS1-107`

That is the main reason the QA Sphere UI showed only `33 passed / 1 failed` instead of reflecting the broader Chromium run.
