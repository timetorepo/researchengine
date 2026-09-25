# Research Engine — Desktop shell (Tauri 2)

A native-feeling desktop app: the OS's own webview (WebView2 on Windows,
WKWebView on macOS, WebKitGTK on Linux) around the Research Engine that runs
locally on your machine. No Electron, no Chromium download, tiny RAM overhead —
and **no Node.js requirement on the user's computer**.

## How it is put together

```
Research Engine_0.25.0_x64-setup.exe        ← what you install (NSIS, per-user)
└─ Research Engine.exe                      ← the Tauri shell (Rust, ~5 MB)
   ├─ research-engine.exe                   ← the sidecar: the entire local server
   └─ resources/frontend-dist/              ← the built UI the server serves
```

The shell owns the whole lifecycle, in this order:

1. Is a Research Engine server already answering on `127.0.0.1:3847`? Reuse it
   (that is what happens during development, or if you open the app twice).
2. Otherwise spawn the sidecar that sits next to the app binary, with
   `FRONTEND_DIST` pointing at the bundled UI.
3. Poll `/api/health` over a raw socket — a connect is not enough, the server has
   to *answer* — and only then open the window straight at
   `http://127.0.0.1:3847/`.
4. When the window closes, the sidecar is killed with it. One process tree, one
   life: nothing keeps holding the port or the database.

Everything stays on loopback. The database is a real SQLite file in
`~/.research-engine` (`%USERPROFILE%\.research-engine` on Windows), so your
chats, documents and projects survive restarts and app updates. Set
`RE_DESKTOP_PORT` to move the app off 3847 if something else lives there.

## Prerequisites

- **Rust** stable — https://rustup.rs
- **Bun** — https://bun.sh — used once to compile the sidecar. No Bun at runtime.
- **Platform webview deps** — on Linux: `libwebkit2gtk-4.1-dev`,
  `libappindicator3-dev`, `librsvg2-dev`, `patchelf`; on Windows/macOS nothing
  extra. Full list: https://tauri.app/start/prerequisites/
- Node 20+ (to build the frontend)

## Develop

```bash
npm install                 # workspace root
node ../scripts/desktop-sidecar.mjs     # or build the sidecar from the root:
npm run desktop:sidecar     # (root script) → desktop/src-tauri/binaries/
cd desktop && npm install
npm run tauri:dev
```

`tauri dev` starts the single-process backend on `127.0.0.1:3847` and opens the
app window pointed at it. The shell notices the already-running server and does
not start a second one.

## Build installers

```bash
# from the repository root:
npm run desktop:build        # → desktop/src-tauri/target/release/bundle/
```

- **Windows** — `bundle/nsis/Research Engine_<version>_x64-setup.exe`. This is
  the `setup.exe`: per-user install (no admin prompt), WebView2 bootstrapper
  downloaded automatically if the machine does not have it, Start-menu entry and
  an uninstaller. No Rust or Node needed on the target machine.
- **Linux** — `bundle/deb/*.deb` and `bundle/appimage/*.AppImage`.
- **macOS** — `bundle/dmg/*.dmg`.

## Check what ships before you ship it

```bash
node scripts/desktop-check.mjs --run
```

Validates the shell's boot order and installer settings from source, then boots
the actual sidecar binary on loopback and insists on a healthy server, a served
page and a persistent SQLite file. CI runs the same script on Windows and Linux
**before** bundling, so an installer is never built around a server that cannot
start.

## CI

The workflow definition is `desktop/ci/desktop.yml` — kept out of
`.github/workflows/` on purpose, because the automation token that maintains
this repository is not allowed to commit workflow files (GitHub App
installations need the extra **Workflows** permission). Installing it is one
command, run by anyone who has that permission:

```bash
node scripts/install-desktop-ci.mjs          # dry run: shows what it would install
node scripts/install-desktop-ci.mjs --write  # copy into .github/workflows/ and stage it
node scripts/install-desktop-ci.mjs --write --push   # …then commit and push
```

Once it is in place it runs on `windows-latest` and `ubuntu-22.04`:

1. build the frontend, compile the sidecar (`scripts/desktop-sidecar.mjs`),
2. run `scripts/desktop-check.mjs --run` on the runner’s platform,
3. `tauri build --bundles nsis` (Windows) or `--bundles deb,appimage` (Linux),
4. upload the installers as artifacts.

Trigger it from the **Actions** tab (workflow dispatch) or by pushing a tag —
`git tag v0.25.0-beta.1 && git push origin v0.25.0-beta.1`. Artifacts land in
`Research Engine_<version>_x64-setup.exe` on the run page and on the release.

## Why a sidecar and not an embedded server?

The product *is* the server: the API, the SSE streams, the document store, the
Coding/Design preview manager. Compiling that whole thing to one file (Bun
`--compile`) keeps a single implementation for web, portable and desktop builds,
and the shell stays small enough to read in one sitting.
