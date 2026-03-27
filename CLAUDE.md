# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QAS CLI (`qas-cli`) is a Node.js CLI tool for uploading test automation results (JUnit XML / Playwright JSON / Allure results directories) to [QA Sphere](https://qasphere.com/). It matches test case references (e.g., `PRJ-123` markers or Allure TMS links) to QA Sphere test cases, creates or reuses test runs, and uploads results with optional attachments.

## Commands

```bash
npm install              # Install dependencies
npm run build            # Clean, compile TS, add .js extensions, chmod entry point
npm run check            # Typecheck + lint + format check
npm test                 # Run all tests (Vitest)
npx vitest run src/tests/junit-xml-parsing.spec.ts   # Run a single test file
npx vitest run -t "test name"                        # Run a specific test by name
npm run lint             # ESLint
npm run lint:fix         # ESLint — auto-fix
npm run format           # Prettier — auto-fix
npm run format:check     # Prettier — check only
npm run typecheck        # tsc --noEmit
```

Node.js compatibility tests: `cd mnode-test && ./docker-test.sh` (requires Docker, tests against Node 18+).

## Architecture

### Entry Point & CLI Framework

- `src/bin/qasphere.ts` — Entry point (`#!/usr/bin/env node`). Validates Node version, delegates to `run()`.
- `src/commands/main.ts` — Yargs setup. Registers three upload commands (`junit-upload`, `playwright-json-upload`, `allure-upload`) as instances of `ResultUploadCommandModule`, plus the `api` command.
- `src/commands/resultUpload.ts` — `ResultUploadCommandModule` defines CLI options shared by both commands. Loads env vars, then delegates to `ResultUploadCommandHandler`.

### Core Upload Pipeline (src/utils/result-upload/)

The upload flow has two stages handled by two classes, with a shared `MarkerParser` instance:

1. **`MarkerParser`** — Centralizes all test case marker detection/extraction/matching logic:
   - Supports three marker formats: hyphenated (`PRJ-123`), underscore-separated hyphenless (`test_prj123_foo`), and CamelCase hyphenless (`TestPrj123Foo` or `TestFooPrj123`)
   - Hyphenless matching (underscore-separated and CamelCase) is gated on `type === 'junit-upload'` and requires the test name to start with `test` (case-insensitive)
   - Created by `ResultUploadCommandHandler` and passed to `ResultUploader` — both share one instance
   - Also exports a standalone `formatMarker()` function used by parsers

2. **`ResultUploadCommandHandler`** — Orchestrates the overall flow:
   - Parses report inputs using the appropriate parser (JUnit XML file, Playwright JSON file, or Allure results directory), which return `ParseResult` objects containing both `testCaseResults` and `runFailureLogs`. File-based parsers receive file contents; directory-based parsers (Allure) receive the path — controlled by the module-level `directoryInputTypes` Set
   - `ParserOptions` includes `allowPartialParse` (set from `--force`) to skip invalid files instead of aborting
   - Detects project code from test case names via `MarkerParser` (or from `--run-url`)
   - Creates a new test run (or reuses an existing one if title conflicts)
   - Collects run-level logs from all parsed files and passes them to `ResultUploader`

3. **`ResultUploader`** — Handles the upload-to-run mechanics:
   - Fetches test cases from the run, maps parsed results to them via `MarkerParser` matching
   - Validates unmatched/missing test cases (respects `--force`, `--ignore-unmatched`)
   - If run-level log is present, uploads it via `createRunLog` API before uploading test case results
   - Uploads file attachments concurrently (max 10 parallel), then creates results in batches (max 50 per request)

### Report Parsers

- `junitXmlParser.ts` — Parses JUnit XML via `xml2js` + Zod validation. Extracts attachments from `[[ATTACHMENT|path]]` markers in system-out/failure/error/skipped elements. Extracts suite-level `<system-err>` and empty-name `<testcase>` errors as run level error logs.
- `playwrightJsonParser.ts` — Parses Playwright JSON report. Supports two test case linking methods: (1) test annotations with `type: "test case"` and URL description, (2) marker in test name. Handles nested suites recursively. Extracts top-level `errors[]` as run level error logs.
- `allureParser.ts` — Parses Allure JSON results directories (`*-result.json` and `*-container.json` files; XML/images ignored). Supports test case linking via TMS links (`type: "tms"`) or marker in test name, maps Allure statuses to QA Sphere result statuses (`unknown→open`, `broken→blocked`), strips ANSI codes and HTML-escapes messages, and resolves attachments via `attachments[].source`. Uses `formatMarker()` from `MarkerParser`. Extracts run-level failure logs from container files by checking `befores`/`afters` fixtures with `failed`/`broken` status — primarily useful for pytest (allure-junit5 and allure-playwright leave container fixtures empty).
- `types.ts` — Shared `TestCaseResult`, `ParseResult`, and `Attachment` interfaces used by both parsers.

### API Command (src/commands/api/)

The `api` command provides direct programmatic access to the QA Sphere public API: `qasphere api <resource> <action> [options]`. Each resource (e.g., `projects`, `runs`, `test-cases`) is a subcommand with its own actions. Some resources have nested subgroups (e.g., `qasphere api runs tcases list`).

**File structure per resource**:

```
src/commands/api/<resource>/
├── command.ts      # Yargs command definitions (list, get, create, etc.) and CLI-specific Zod schemas
└── help.ts         # Help text and descriptions
```

- `main.ts` — Registers all resource subcommands via `.command()`
- `utils.ts` — Shared helpers: `apiHandler<T>()` wraps handlers with lazy env loading and error handling; `printJson()` outputs formatted JSON; `parseJsonArg()` supports inline JSON or `@filename`; `parseAndValidateJsonArg()` and `validateWithSchema()` validate with Zod and produce detailed error messages; `apiDocsEpilog()` appends API doc links

Important note: Online documentation is available at https://docs.qasphere.com. Most leaf pages have a markdown version available by appending `.md` in the URL. Use the markdown version before falling back to the original URL if the markdown version returns >= 400 status.

**Key design patterns**:

- **Lazy env loading**: `QAS_URL`/`QAS_TOKEN` are loaded only when the API is actually called (via `connectApi()`), so CLI validation errors are reported first
- **JSON argument flexibility**: Complex args accept inline JSON or `@filename` references (e.g., `--query-plans @plans.json`)
- **Validation flow**: API-level Zod schemas (in `src/api/*.ts`) validate request structure and strip unknown fields. All commands catch `RequestValidationError` via `.catch(handleValidationError(buildArgumentMap([...])))` to reformat API error paths into CLI argument names (e.g., `--query-plans: [0].tcaseIds: not allowed for "live" runs`). Complex JSON args (e.g., `--query-plans`, `--body`, `--steps`) are pre-validated with `parseAndValidateJsonArg()` / `parseOptionalJsonField()` for early feedback before the API call

### API Layer (src/api/)

Composable fetch wrappers using higher-order functions:

- `utils.ts` — `withBaseUrl`, `withApiKey`, `withJson`, `withDevAuth` decorators that wrap `fetch`; `jsonResponse<T>()` for parsing responses; `appendSearchParams()` for building query strings
- `index.ts` — `createApi(baseUrl, apiKey)` assembles the API client from all sub-modules
- `schemas.ts` — Shared types (`ResourceId`, `ResultStatus`, `PaginatedResponse<T>`, `PaginatedRequest`, `MessageResponse`), `RequestValidationError` class, `validateRequest()` helper, and common Zod field definitions (`sortFieldParam`, `sortOrderParam`, `pageParam`, `limitParam`)
- One sub-module per resource (e.g., `projects.ts`, `runs.ts`, `tcases.ts`, `folders.ts`), each exporting a `create<Resource>Api(fetcher)` factory function. Each module defines Zod schemas for its request types (PascalCase, e.g., `CreateRunRequestSchema`), derives TypeScript types via `z.infer`, and validates inputs with `validateRequest()` inside API functions

The main `createApi()` composes the fetch chain: `withDevAuth(withApiKey(withBaseUrl(fetch, baseUrl), apiKey))`.

### Configuration (src/utils/)

- `env.ts` — Loads `QAS_TOKEN` and `QAS_URL` from environment variables, `.env`, or `.qaspherecli` (searched up the directory tree). Optional `QAS_DEV_AUTH` adds a dev cookie via the `withDevAuth` fetch decorator
- `config.ts` — Constants (required Node version)
- `misc.ts` — URL parsing, template string processing (`{env:VAR}`, date placeholders), error handling utilities. Note: marker-related functions have been moved to `MarkerParser.ts`
- `version.ts` — Reads version from `package.json` by traversing parent directories

## Testing

Tests use **Vitest** with **MSW** (Mock Service Worker) for API mocking. Test files are in `src/tests/`.

### Upload Command Tests

- `result-upload.spec.ts` — Integration tests for the full upload flow (JUnit, Playwright, and Allure), with MSW intercepting all API calls. Includes hyphenless and CamelCase marker tests (JUnit only)
- `marker-parser.spec.ts` — Unit tests for `MarkerParser` (detection, extraction, matching across all marker formats and command types)
- `junit-xml-parsing.spec.ts` — Unit tests for JUnit XML parser
- `playwright-json-parsing.spec.ts` — Unit tests for Playwright JSON parser
- `allure-parsing.spec.ts` — Unit tests for Allure parser
- `template-string-processing.spec.ts` — Unit tests for run name template processing

Test fixtures live in `src/tests/fixtures/` (XML files, JSON files, and mock test case data).

### API Command Tests (src/tests/api/)

Tests for the `api` command are organized by resource under `src/tests/api/`, with one spec file per action (e.g., `projects/list.spec.ts`, `runs/create.spec.ts`). Tests support both mocked and live modes.

**Shared infrastructure** (`src/tests/api/test-helper.ts`):

- `baseURL`, `token` — Configured base URL and token (mocked values or real from env vars)
- `useMockServer(...handlers)` — Sets up MSW server with lifecycle hooks (before/after each test)
- `runCli(...args)` — Invokes the CLI programmatically via `run(args)`, captures and parses JSON output. Useful only if the command prints JSON.
- `test` fixture — Extended Vitest `test` that provides a `project` fixture (mock project in mocked mode, real project with cleanup in live mode)
- Helper functions for live tests: `createFolder()`, `createTCase()`, `createRun()`

**Global setup** (`src/tests/global-setup.ts`): Authenticates against the live API (if env vars are set) and provides a session token for test project cleanup.

**Test pattern**: Each spec file typically contains:

1. A `describe('mocked', ...)` block with MSW handlers and assertions on request headers/params
2. Validation error tests checking CLI argument validation
3. Live tests tagged with `{ tags: ['live'] }` that run against a real QA Sphere instance

**Other tests**:

- `missing-subcommand-help.spec.ts` — Verifies incomplete commands (e.g., `api` alone, `api projects` alone) show help text
- `api/utils.spec.ts` — Unit tests for API command utility functions

### Running Tests

```bash
npm run test                                    # Run all tests (mocked only by default)
npm run test:live                               # Run live tests only (requires env vars)
```

### Environment Variables for Live API Tests

Live tests require all four variables to be set; otherwise tests run in mocked mode only:

| Variable            | Purpose                                               |
| ------------------- | ----------------------------------------------------- |
| `QAS_TEST_URL`      | Base URL of the QA Sphere instance                    |
| `QAS_TEST_TOKEN`    | API token for authenticated API calls                 |
| `QAS_TEST_USERNAME` | Email for login endpoint (used by global setup)       |
| `QAS_TEST_PASSWORD` | Password for login endpoint (used by global setup)    |
| `QAS_DEV_AUTH`      | (Optional) Dev auth cookie value for dev environments |

The `tsconfig.json` excludes `src/tests` from compilation output.

## Build

ESM project (`"type": "module"`). TypeScript compiles to `build/`, then `ts-add-js-extension` adds `.js` extensions to imports (required for ESM). The CLI binary is `build/bin/qasphere.js`.

## Linting & Formatting

- **Linter**: ESLint with typescript-eslint (config: `eslint.config.mjs`)
- **Formatter**: Prettier (config: `.prettierrc`)
- **Pre-commit hook** (Husky): runs lint-staged (Prettier + ESLint on staged files)
- **Commits**: Do NOT add `Co-Authored-By` lines to commit messages
