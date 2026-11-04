# 14. Known issues

This is the honest list. Each item was observed in the code or in a test run, and
where a cause is known it is stated. Items marked **verify** have not been
reproduced in a real browser or desktop build. Update this page when an item is
fixed, or when a new one is found.

## Desktop app

- **Opening a sign-in page from the desktop app may do nothing.** The desktop shell
  (`desktop/src-tauri/Cargo.toml`) has `tauri` and `tauri-build` only and no opener
  plugin. Calls to `window.open` and links with `target="_blank"` are no-ops in
  Tauri. The connect flow now sends the URL to `POST /api/composio/open` for the
  system browser. **Verify** on each platform.
- **`window.confirm` does not appear in the desktop app.** Use the in-app dialog.
- **Local Tauri builds need Rust.** Without `cargo`, the desktop app is built only
  in CI.

## Data

- **Chat history is not stored on the server**, although the `data.ts` header
  says it is. Chats live in the browser. `db.insertChat` exists and nothing calls it.
  The schema also defines `chats`, `messages`, `skills` and `citations` tables that
  no route writes. Fix the header, or move chat storage, deliberately.
- **Two environment variables for one directory.** `routes/personas.ts` and
  `routes/skills.ts` read `RE_DATA_DIR`. The runtime sets
  `RESEARCH_ENGINE_DATA_DIR`. Setting only one puts personas and skills in a
  different place from the rest of the data. Use one name.
- **`.env.example` sets `PORT=8787`.** That value is for development. A built
  server reads it too, which can clash with other services. The default is 3847.
- **The in-memory database fallback loses data on restart.** It happens when neither
  SQLite engine loads. `/api/health` reports `db.engine: "memory"`. Check it after
  installing on a new machine.
- **The wipe route has no authentication** (`POST /api/data/wipe`). It is safe only
  while the server listens on loopback, the default. Do not expose the server to a
  network without adding authentication.

## Security

- **The updater checks integrity, not authenticity.** `SHA256SUMS` proves an archive
  matches its release tag. It does not prove the release was made by the maintainer.
- **The vault keeps keys in plain form without a passphrase.** The app warns, but
  the mode is still available.
- **Provider traffic goes direct from the browser to the model provider in some
  paths (verify which per provider).** The Privacy Shield modes describe what is scanned. Check the path before
  promising a host-level guarantee.

## Build, test and CI

- **`render-check.mts` crashes** on the current code and on the baseline, with a
  motion scroll-reference invariant. It is not a regression, but it cannot be a gate
  until fixed.
- **`updates-ui-test` has one failing check** that predates the current work.
- **A stale copy of the desktop workflow** exists at `desktop/ci/desktop.yml`. It
  differs from `.github/workflows/desktop.yml`. The `.github/workflows` copy is the
  one that runs. Delete the stale copy or make it generated.
- **`npm ci` at the root fails on `onnxruntime-node`'s install script** in some
  environments. Use `npm ci --ignore-scripts`.
- **`npm ci` inside `frontend/` or `backend/` can remove the nested `@heroui/react`**
  install. Install from the root.
- **GitHub Actions can show zero steps** when the account has run out of minutes.
  That is not a workflow failure.
- **`gh workflow run` may be refused** by permissions. A tag push is the reliable
  trigger.
- **Two animation libraries** are declared in the frontend (`motion` and
  `framer-motion`). Check their use and remove the one that is not needed.

## Features

- **Browser verification is pending for recent UI work.** The ReactBits backgrounds,
  CardSwap, GooeyNav and the connectors restyle were built and type-checked, but not
  seen in a real browser. **Verify** before relying on their appearance.
- **Some ReactBits components were vendored by hand.** The shadcn CLI and the
  ReactBits site could not be reached from the build environment, so the source came
  from the ReactBits GitHub repository. Check the vendored files against the
  upstream versions when updating.
- **Context-window sizes are approximate.** Providers do not report them, so the
  top bar uses a family lookup.
- **Meeting transcription depends on the speech model download.** The first use
  downloads the Whisper model. On a laptop with 4 GB of RAM, close other heavy tabs
  before transcribing a long meeting. **Verify** on that hardware.
- **Eco mode cannot detect memory on every browser.** Safari and WebKitGTK do not
  expose it, so eco mode is not chosen automatically. It is a setting.
- **Services depend on keys you supply.** Without them, the services report that
  they are not connected, rather than failing silently.
- **Postiz creates drafts only.** This is deliberate, not a missing feature.

## Documentation

- **This handbook's generated reference is only as current as the last run** of
  `docs/technical/tools/generate-reference.mjs`. Regenerate after route or component
  changes.
- **The `api-routes.md` "not in this table" section is partly speculative.** The
  scanner may miss routes mounted in non-standard ways. Check that section against
  `backend/src/index.ts` before relying on it.
- **Some older docs describe earlier versions.** `docs/HANDOFF.md` and `docs/development.md`
  refer to older release numbers in places. This handbook is current to the date on
  its index page.
