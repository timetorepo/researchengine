# Research Engine 0.25.0-beta.1 — "the click you made is the page you get" + a real desktop app

## Navigation: both bugs were the same mistake

A click used to **wait for the page's code file to download before it moved**:

- tapping a screen you had not opened yet did nothing at all until the download finished — the *"when i click a page it automatically doesnt load"*;
- and if that download finished *after* you had already picked something else, it pushed you onto the **older** page — the *"when i wanted to go to a page but i go to another page it instead goes to that page not the page i selected after"*.

Now:

- `navigateNow()` moves in the **same tick as your tap** — nothing is awaited;
- the page file is fetched **beside** the move, never in front of it;
- a page you have already visited opens instantly, and hovering a sidebar or dock item **warms** the next screen before you click;
- a late download can only ever warm the cache — it can never navigate;
- View Transitions only animate a page whose code is already in hand, so a cold page can never freeze the frame; the progress hairline covers that case.

Proof is in the suite: click a cold route, then a warm one, and the later click is the one that lands — the earlier fetch never pushes again.

## Desktop: Tauri 2, and `setup.exe`

- `scripts/desktop-sidecar.mjs` compiles the **entire local server to a single file** with Bun (and cross-compiles a Windows `.exe` from Linux/macOS CI), so the app needs **no Node, no Electron and no browser** on the user's machine.
- The Rust shell reuses a server already on `127.0.0.1:3847` or spawns the sidecar next to the app binary, **waits for `/api/health` to actually answer**, opens the window at it, and kills it when the window closes.
- `scripts/desktop-check.mjs` validates the boot order and installer settings, then boots the shipped sidecar on loopback and insists on a healthy server, a served page and a **persistent SQLite file** — CI runs it before bundling, on Windows and on Linux.
- `scripts/verify-installer.mjs` checks the installer's magic bytes, NSIS signature and size before it is uploaded.

## Installing this build

### Desktop installers (built and verified by CI)

| Platform | File | Size | sha256 |
|---|---|---|---|
| Windows 10/11 x64 | `Research.Engine_0.25.0-beta.1_x64-setup.exe` | 38.0 MB | `19729157f972887437b0796ff9cb34468f11da692c462864033cfbdd0023d3f6` |
| Linux x64 | `Research.Engine_0.25.0-beta.1_amd64.deb` | 46.4 MB | `85b0d8daba47889749a6b5f4234bcef0f960bc91a2d36d55f080cc530626e922` |
| Linux x64 | `Research.Engine_0.25.0-beta.1_amd64.AppImage` | 121.4 MB | `4b318208f68f06098f295cf5512ddcdc11539e4c47043c13df736e1af13fb676` |

The Windows install is per-user (no admin prompt), pulls the WebView2 bootstrapper only when the machine does not already have it, and adds a Start-menu entry plus an uninstaller. Your chats, documents and projects live in one real SQLite file in `%USERPROFILE%\.research-engine` (`~/.research-engine` on Linux) — the desktop app, the portable build and a browser tab all read the same library.

### Portable (needs Node 20+)

- `research-engine-0.25.0-beta.1-win-x64.zip`
- `research-engine-0.25.0-beta.1-linux-x64.tar.gz`

Verify with `sha256sum -c SHA256SUMS`.

### Build it yourself (any OS)

```bash
npm install          # "bun" is a devDependency — it compiles the server
npm run build        # frontend + backend
npm run desktop:sidecar
npm run desktop:check    # boots the compiled server and insists it serves a real page
npm run desktop:build    # → desktop/src-tauri/target/release/bundle/
```

CI: `.github/workflows/desktop.yml` (source of truth `desktop/ci/desktop.yml`) runs on `windows-latest` and `ubuntu-22.04` for every `v*` tag and attaches the installers here.

## Verification for this round

`desktop-check 46/0 (--run: healthy server, served page, persistent SQLite) · render-check 381/0 · smoke 65/0 · ui-test 60/0 · sample-test 33/0 · design-test 32/0 · engine/workflow/bg-props PASSED · tsc clean · CI: Windows + Linux jobs verified and attached`
