# Repository Guidelines

## Project Structure & Module Organization
- `src/bin/` CLI entry (`qasphere.ts`). Built to `build/bin/qasphere.js`.
- `src/commands/` yargs command modules (e.g., `junit-upload.ts`). Register in `src/commands/main.ts`.
- `src/api/` thin API clients; `src/utils/` helpers (env, parsing, version, JUnit upload).
- `src/tests/` Vitest specs and fixtures. Source is TypeScript (ESM). Build output goes to `build/`.
- `mnode-test/` Docker script to verify Node 18/20/22/24 compatibility.

## Build, Test, and Development Commands
- `npm install` install dependencies.
- `npm run build` type-check, compile to `build/`, add `.js` extensions, make CLI executable.
- `npm test` run Vitest once. `npm run test:watch` watch mode.
- `npm run lint` ESLint with auto-fix. `npm run typecheck` TS check only. `npm run check` runs both.
- Local CLI: `npm link` then `qasphere --version` or `node build/bin/qasphere.js --help` after build.

## Coding Style & Naming Conventions
- Language: TypeScript (strict), ESM.
- Formatting: Prettier (tabs, width 2; single quotes; no semicolons; trailing comma es5; print width 100).
- Linting: ESLint (`@eslint/js` + `typescript-eslint`), `build/` is ignored.
- Names: files kebab-case (`junit-upload.ts`), classes PascalCase, variables/functions camelCase. Prefer named exports.

## Testing Guidelines
- Framework: Vitest. Place tests under `src/tests/` with `*.spec.ts` naming.
- Mocks: use `msw` for HTTP. Put test data under `src/tests/fixtures/`.
- Run: `npm test` locally and in CI. Keep tests deterministic and isolated.

## JUnit XML Edge Cases
- Parser: xml2js may emit strings or `{ _: string }` objects for text; empty tags like `<system-err></system-err>` are valid. Keep schema flexible when editing `src/utils/junit/junitXmlParser.ts`.
- Skipped: supports empty `<skipped/>`, text content, and `message` attribute.
- Fixtures: add minimal XML files under `src/tests/fixtures/junit-xml/` (e.g., `empty-system-err.xml`) and a matching spec in `src/tests/junit-xml-parsing.spec.ts`.
## Commit & Pull Request Guidelines
- Commits: short imperative subject (≤72 chars), include context/scope when useful. Reference issues/PRs (e.g., `(#29)`).
- Before PR: run `npm run check && npm test`. Describe changes, rationale, and testing notes. Include usage examples for CLI changes.
- Link related issues. Maintainers: add `publish` label to release to npm.

## Security & Configuration Tips
- Required env: `QAS_TOKEN`, `QAS_URL`. You may also use a `.qaspherecli` file (repo-ignored) in the project root.
- Never commit secrets. `.qaspherecli` is in `.gitignore`.
- Minimum Node: v18. Use `mnode-test/docker-test.sh` to validate multi-version support when changing runtime-sensitive code.
