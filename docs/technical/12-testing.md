# 12. Testing

Tests in this project are scripts, not a test runner's framework. Each script runs
against real code and either prints `ALL PASS: n passed, 0 failed` or fails. The
suites are listed in [docs/development.md](../development.md#tests). This chapter
explains how to run them and what to expect.

## Where the tests live

| Area | Folder | Count | Runner |
|---|---|---|---|
| Frontend | `frontend/scripts/` | about 70 files | `npx tsx scripts/<name>.mts` (with `--tsconfig tsconfig.json`), or an npm script |
| Backend | `backend/scripts/` | 9 files | `npm run api-json-test` in `backend/`, or `npx tsx scripts/<name>.ts` |
| Website | `website/scripts/` | `site-test.mts` (78 checks) | `npm run site-test` in `website/` |
| Root | the `package.json` at the root | `smoke`, `render-probe`, `api:json-test` | `npm run <name>` |

The frontend `package.json` has 43 npm scripts, most of them test suites. For a single area, run its
npm script, for example:

```bash
cd frontend
npm run reactbits-test      # 7 checks for the vendored ReactBits components
npm run services-test       # the services adapters, against stubbed networks
npm run bots-test           # bot logic and limits
npm run ecc-roles-test      # ECC family selection
npm run connectors-test     # connector routes and identity
```

## What to run before a change

| You changed | Run |
|---|---|
| Any TypeScript | The TypeScript check: `npx tsc --noEmit` in `frontend/` and in `backend/` |
| Any UI component | The build (`npm run build`), then `render-check.mts` and `smoke.mts` |
| Backend routes | `npm run api-json-test` in `backend/`, plus the matching script |
| Background kinds | `bg-props-test.mts` (checks every entry of `ANIMATED_BG_KINDS`) |
| Chat engine | `engine-test.mts` (pacing and pruning), `context-budget-test` |
| Release | Everything above, plus the create-path bench against the packaged build |

The project's rule: say which suites you ran. A pull request should not claim
"tests pass" without naming them.

## Known failing or unreliable checks

These are real and are recorded in [known issues](14-known-issues.md):

- `render-check.mts` crashes on the current code and on the baseline too, with a
  motion scroll-reference invariant. It is not a regression, but it cannot be used
  as a gate until the crash is fixed.
- `updates-ui-test` has one failing check that predates the current work.
- Some suites need a running instance (the bench), or the network (`update-test`
  checks a real release when online and skips when offline).

## Writing a test

1. Put it in the matching folder, named `<feature>-test.mts`.
2. Import the real module. Do not copy the logic into the test.
3. Stub the network, not the code under test. Fixed, realistic responses are better
   than mocks that always succeed.
4. Print one summary line and exit non-zero on failure.
5. Add an npm script in the matching `package.json`.

For components, the `*-ui-test` suites mount the component in jsdom and check the
behaviour a person would see.

## Browser checks

Visual and interaction checks in a real browser are part of the release gate, but
they have not always been possible in the development environment. Where a visual
check is pending, say so in the pull request rather than claiming it passed.
