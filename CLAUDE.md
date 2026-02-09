# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QAS CLI (`qas-cli`) is a Node.js CLI tool for uploading test automation results (JUnit XML / Playwright JSON) to [QA Sphere](https://qasphere.com/). It matches test case markers (e.g., `PRJ-123`) in report files to QA Sphere test cases, creates or reuses test runs, and uploads results with optional attachments.

## Commands

```bash
npm install              # Install dependencies
npm run build            # Clean, compile TS, add .js extensions, chmod entry point
npm run check            # Typecheck + lint (runs on pre-commit hook via Husky)
npm test                 # Run all tests (Vitest)
npx vitest run src/tests/junit-xml-parsing.spec.ts   # Run a single test file
npx vitest run -t "test name"                        # Run a specific test by name
npm run lint             # ESLint with --quiet --fix
npm run typecheck        # tsc --noEmit
```

Node.js compatibility tests: `cd mnode-test && ./docker-test.sh` (requires Docker, tests against Node 18+).

## Architecture

### Entry Point & CLI Framework

- `src/bin/qasphere.ts` — Entry point (`#!/usr/bin/env node`). Validates Node version, delegates to `run()`.
- `src/commands/main.ts` — Yargs setup. Registers two commands (`junit-upload`, `playwright-json-upload`) as instances of the same `ResultUploadCommandModule` class.
- `src/commands/resultUpload.ts` — `ResultUploadCommandModule` defines CLI options shared by both commands. Loads env vars, then delegates to `ResultUploadCommandHandler`.

### Core Upload Pipeline (src/utils/result-upload/)

The upload flow has two stages handled by two classes:

1. **`ResultUploadCommandHandler`** — Orchestrates the overall flow:
   - Parses report files using the appropriate parser (JUnit XML or Playwright JSON)
   - Detects project code from test case names (or from `--run-url`)
   - Creates a new test run (or reuses an existing one if title conflicts)
   - Delegates actual result uploading to `ResultUploader`

2. **`ResultUploader`** — Handles the upload-to-run mechanics:
   - Fetches test cases from the run, maps parsed results to them via marker matching
   - Validates unmatched/missing test cases (respects `--force`, `--ignore-unmatched`)
   - Uploads file attachments concurrently (max 10 parallel), then creates results in batches (max 50 per request)

### Report Parsers

- `junitXmlParser.ts` — Parses JUnit XML via `xml2js` + Zod validation. Extracts attachments from `[[ATTACHMENT|path]]` markers in system-out/failure/error/skipped elements.
- `playwrightJsonParser.ts` — Parses Playwright JSON report. Supports two test case linking methods: (1) test annotations with `type: "test case"` and URL description, (2) marker in test name. Handles nested suites recursively.
- `types.ts` — Shared `TestCaseResult` and `Attachment` interfaces used by both parsers.

### API Layer (src/api/)

Composable fetch wrappers using higher-order functions:
- `utils.ts` — `withBaseUrl`, `withApiKey`, `withJson` decorators that wrap `fetch`
- `index.ts` — `createApi(baseUrl, apiKey)` assembles the API client from sub-modules
- Sub-modules: `projects.ts`, `run.ts`, `tcases.ts`, `file.ts`

### Configuration (src/utils/)

- `env.ts` — Loads `QAS_TOKEN` and `QAS_URL` from environment variables, `.env`, or `.qaspherecli` (searched up the directory tree)
- `config.ts` — Constants (required Node version)
- `misc.ts` — URL parsing, template string processing (`{env:VAR}`, date placeholders), error handling utilities
- `version.ts` — Reads version from `package.json` by traversing parent directories

## Testing

Tests use **Vitest** with **MSW** (Mock Service Worker) for API mocking. Test files are in `src/tests/`:
- `result-upload.spec.ts` — Integration tests for the full upload flow (both JUnit and Playwright), with MSW intercepting all API calls
- `junit-xml-parsing.spec.ts` — Unit tests for JUnit XML parser
- `playwright-json-parsing.spec.ts` — Unit tests for Playwright JSON parser
- `template-string-processing.spec.ts` — Unit tests for run name template processing

Test fixtures live in `src/tests/fixtures/` (XML files, JSON files, and mock test case data).

The `tsconfig.json` excludes `src/tests` from compilation output.

## Build

ESM project (`"type": "module"`). TypeScript compiles to `build/`, then `ts-add-js-extension` adds `.js` extensions to imports (required for ESM). The CLI binary is `build/bin/qasphere.js`.
