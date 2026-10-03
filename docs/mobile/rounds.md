# Rounds log — mobile port

Convention (brief §13): every round ends with a build, tests, a push and a tag.
This file is the release-note ledger; round acceptance lines are checked here
against *measured* results, not intent.

---

## R1 — the shell and the design system (this commit; tag `mobile-r1`)

Shipped:

- `packages/tokens`: `tokens.json` as single source (12 themes, radius/space/
  type/motion/frameBudget/latency blocks), generators → `tokens.css` /
  `ReTheme.swift` / `ReTheme.kt`. 13 checks in `packages/tokens/test/` prove
  JSON == `frontend/src/styles/globals.css` == `themes/meta.ts` == generated
  outputs, and that `crates/re-core/src/schema/schema_v1.sql` equals the
  backend's `MIGRATION` template (schema shared as SQL, brief §3.1).
- `packages/prompts` (7 master prompts + 7 builtin skills extracted by
  importing the *real* desktop modules; byte-drift test) and `packages/types`
  (11 providers, 12 theme ids, quiz/privacy/glass/profile unions; drift test).
- `mobile/`: Tauri 2 project (conf, thin Rust entry, capabilities, CSP with
  `connect-src 'self'`), React shell with three destinations + raised Ask,
  160-line-quality sheet detents, theme engine (all 12, ≤10 ms p95 JS apply,
  60-switch sample), quality governor rAF sampler with the tokens' thresholds,
  haptics map from `07`, snackbar/empty/skeleton states from `09`.
  Design preview at `?design=1`: 26 components × all states × 5 frames ×
  12 themes × 3 text scales × 3 quality levels.
- `crates/re-core`: frame-budget governor (Full/Lean/Minimum, hysteresis 2/4,
  thermal + low-power inputs) and the job queue state machine — 12 unit tests
  written, **not compiled here**: the sandbox has no Rust toolchain
  (rustup.rs unreachable). `crates/re-{net,models,fs}` ship typed stubs.
- `mobile/bench/scenes.json`: all 8 benchmark scenes with per-scene budgets;
  a test asserts they satisfy the global frame gates.
- `docs/mobile/`: all thirteen documents + parity matrix + screens
  (home/library/you written, rest stubbed with owners). `parity-matrix.md`
  records the version reality (0.16.0-beta.1, not 0.36.0-beta.1), the corrected
  provider count (11), the absent `BUDGET_MS`/`frame-budget.ts`/voice route,
  the all-rights-reserved license, and the localStorage-vs-SQLite ordering
  constraint for R2.

Verification status (honest, per 00 principle 3):

| Gate | Result |
|---|---|
| Token tests (`tokens:test`) | 13/13 pass |
| Prompts/types drift | 5/5 + 7/7 pass |
| Mobile suite (`mobile:test`) | 35/35 pass |
| `vite build` | ok (184 kB JS, 60 kB gz) |
| `cargo test` (crates) | deferred: no Rust in sandbox; runs in CI job `rust` |
| iOS/Android builds | deferred: no Xcode/Android SDK in sandbox; CI `android-compile` + macOS runner (R2) |
| R1 acceptance "opens on an iPhone and a low-end Android at 60/120 fps, correct theme and safe areas" | **pending device CI** — the web artifact is built and tested; safe areas, theme and ladder are wired; the on-device measurement is not yet run, so the line is open, not claimed |

Next (R2, brief §13): `re-core` SQLite + FTS5 index + persisted jobs,
kill-mid-write test, 50k-document query ≤ tier-1, and the desktop-side
store→SQLite promotion plan executed (the parity matrix calls this the most
important correction in the brief; R2 acceptance depends on it).
