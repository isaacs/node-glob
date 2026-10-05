# AGENTS

## Project Context

### Tech Stack

- `tshy` for building typescript
- `tap` for testing
- `npm` for package management and running project scripts
- `oxlint` for linting
- `prettier` for formatting

### Purpose

- A fast and featureful bash-compatible glob matcher in
  JavaScript

### Structure

- `./src/*.ts` Source files
- `./test/*.ts` Tap test files
- `./test/fixtures/` test fixtures
- `./scripts/` various project scripts

## Critical Commands

- Running tests: `npm test`
- Running tests, updating snapshots: `npm snap`
- Building code: `npm run prepare`
- Running benchmarks: `npm run bench`
- Linting: `npm run lint`
- Formatting code: `npm run format`
- Regenerating Bash behavior test fixtures: `npm run test-regen`
  **IMPORTANT** This should _only_ be run on systems with a
  recent `Bash 5.3` build as the default `bash` binary.
- Benchmarking: `npm run bench`
- Profiling: `npm run prof`
- Generating docs: `npm run typedoc`

## Coding Standards & Rules

### Language

Use TypeScript exclusively; avoid `any`.

### Code Organization

Every class must be in its own css-case-named file under `src`.
For example, a class named `AsyncHookManager` would live in
`src/async-hook-manager.ts`.

### DRY (Don't Repeat Yourself)

Do not duplicate functions, methods, or objects unnecessarily.

Prefer to consolidate and reuse code whenever possible.

**NEVER** add new methods, objects, or functions, without
explicit human direction. When asked to do so, make the
_smallest_ possible increase to the API surface area.

### Testing

- 100% test coverage is critically important.
- Every patch **must** include a test that fails without the
  patch, and passes with the patch.
- Tests should be human readable.
- Prefer adding to an existing set of test cases rather than
  writing a new test, if possible.
- All new features require matching tests in the `/tests`
  directory.
- Run `npm test` before proposing a solution to ensure no
  regressions.
- Mock external API calls using `t.mockImport`.

### Documentation

Export all types.

Every public method and option must have a JSDoc comment.

### Commit Messages

Do not use "semantic commits". Whether it is a feature, fix, or
chore, should be evident from context.

The first line of the commit message should summarize the change
in less than 50 characters

Write commit messages in the present tense imperative voice,
describing what the patch does without qualifiers or referring to
the patch itself. For example: `add whiz deduplication for
performance`, not `patch adds whiz deduplication, which should
improve performance somewhat`.

The body of the commit message, if necessary, should explain the
reasoning behind the change, with hard line-breaks at 80
characters.

If there are breaking behavior changes for users, these **MUST**
be described in the commit message body.

The commit message should only very rarely mention the
implementation – that should be evident from the code change
itself. However, it _may_ be worthwhile to explain _why_ a given
implementation is chosen, when alternatives exist.

Commit messages, like code, should be as minimal as possible to
accomplish their goal.

- **NEVER** link to or reference IDs of bugs, issues, or other
  objects in issue trackers other than the GitHub issue tracker
  for this repository.
- **DO** include a `fix: #1234` link to any GitHub issues that
  this patch fixes, or `re: #1234` link to any GitHub issues or
  pull requests that are relevant to this change.

## Boundaries & Guardrails

- **DO NOT** modify anything in the `/scripts` directory.
- **DO NOT** commit secrets or `.env` files.
- **NEVER** use `force` flags when running Git commands.
- If a task requires a new dependency, ask the human to perform
  the command.
- **DO NOT** modify `package.json` or `package-lock.json`.
- Run `npm run bench` before and after any significant patches,
  to ensure that there are no performance regressions.
