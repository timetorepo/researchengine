# Developing Research Engine

For contributors, tinkerers, and anyone building their own release. If you just
want to *use* the app, [install.md](install.md) is the friendlier document.

The short version:

```bash
git clone https://github.com/timetorepo/researchengine.git
cd researchengine
npm install
npm run build
npm start                     # http://127.0.0.1:3847
```

## Requirements

- **Node.js 20+** (22.5+ recommended — the server then persists data with Node's
  built-in SQLite, so no native modules are compiled)
- **npm 10+**
- Optional: **Docker** (container builds), **Rust stable** (desktop app),
  **Bun** (single-file launcher builds)

Platforms: **Windows 10/11 x64 and Linux x64/arm64**. There is no macOS build
yet: the engine and the interface run there from source, but no installer is
produced and no macOS runner is configured in CI. The Tauri shell builds on
Windows (WebView2) and Linux (WebKitGTK); on Linux you also need
`libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev` and `patchelf`.

## Repository layout

```text
researchengine/
├── frontend/        # React + Vite + Motion + CSS custom-property theming
│   ├── src/components/      # UI: chat, quiz, articles, agents, IDE, settings
│   ├── src/components/input/     # the composer: modes, integrations, skills, voice
│   ├── src/components/ui/reactbits/  # vendored React Bits components (Micro + classic)
│   ├── src/lib/flow/        # AIFlowEngine: classifier, context pruner, cache, pacing
│   ├── src/lib/chat/        # tool registry, streaming run loop, humanize
│   ├── src/lib/integrations/# the integration catalogue and its client
│   ├── src/lib/providers/   # provider registry, keys, streaming adapters
│   ├── src/lib/search/      # search backends and result shaping
│   └── scripts/             # every test suite (see below)
├── backend/         # Hono + SQLite (node:sqlite, in-memory fallback)
│   ├── src/routes/          # api surface, streaming, integrations, updates
│   ├── src/services/        # search, integrations, update, filesystem services
│   └── src/preview/         # dev-server detection, injecting proxy, design bridge
├── desktop/         # Tauri 2 shell (Rust) + packaging config
├── downloads/       # prebuilt portable archives + checksums + bench report
├── scripts/         # dev.mjs, package-binary.mjs, desktop-sidecar.mjs, …
├── website/         # the public site (Vite, static, deploys to Netlify)
├── Dockerfile.single
└── compose.slim.yml
```

## Daily loop

```bash
npm run dev            # hot reload: frontend on :5173, API on :8787, proxied
```

## Tests

Everything is a script that runs against real code, and each one prints
`ALL PASS: n passed, 0 failed` or fails loudly. Run them from `frontend/`
(`npx tsx --tsconfig tsconfig.json scripts/<name>.mts`) or with the npm script
where one exists (root `npm run render-probe`, `npm run smoke`).

| Suite | What it proves |
|---|---|
| `render-check.mts` | The largest harness: renders real components in jsdom and asserts behaviour — navigation, the picker, the composer's popovers, dictation, integrations menus, settings tabs, theming, and the built stylesheet's cascade layers |
| `integrations-test.mts` | Every integration adapter against a stubbed network: exact URL, auth header, API version header, method and body per service, plus "not connected" reported as an answer rather than an empty result |
| `models-test.mts` | Model catalogue, tiers, logos, per-provider timeouts, token accounting |
| `update-test.mts` | The updater end to end: check, download, checksum, unpack, swap, rollback, and a real over-the-network update from a published release (skipped when offline) |
| `nav-test.mts` | One click, one page — routing under the view-transition layer |
| `ui-test.mts`, `design-test.mts` | IDE chrome, design bridge, preview proxy, UI test runner |
| `smoke.mts`, `sample-test.mts` | Functional smoke path and the sample-app create → preview → audit flow |
| `share-test.mts` | Share Studio output for every style |
| `workflow-test.mts`, `engine-test.mts` | Workflow execution and the AIFlowEngine pacing/pruning logic |
| `render-probe.mts`, `bg-props-test.mts` | Render probes and background properties across all themes |
| `bench-report.mts` | The create-path bench, run against a *running* instance (this is the report shipped in `downloads/`) |
| `r17-test.mts`, `r18-test.mts` | The R17 and R18 contracts: link previews, feedback, skill scanning, notifications, the update resume, the Library search route, the vendored shadcnspace blocks |
| `r17-ui-test.mts`, `r18-ui-test.mts` | The same rounds mounted in jsdom: the search's three paths, the vanish input's exit, and every vendored block doing its job |
| `website/scripts/site-test.mts` | The public site mounted in jsdom (78 checks): the eleven vendored components, the quotes, the download built from this repository, Lenis, and the Netlify configuration |

Gates used on every release: TypeScript strict check on both workspaces, the
production build, the suites above, and the create-path bench against the
packaged build. A pre-release is tagged only when all of them pass.

## Packaging

```bash
node scripts/package-binary.mjs                          # portable folder for this machine
node scripts/package-binary.mjs --target win-x64         # cross-package a Windows folder
node scripts/package-binary.mjs --bun                    # single-file launcher (Bun)
```

The output lands in `release/`, and the shipped archives in `downloads/` are
produced from exactly that folder:

```bash
cd release
tar -czf ../downloads/research-engine-<version>-linux-x64.tar.gz research-engine-linux-x64
zip -qr ../downloads/research-engine-<version>-win-x64.zip research-engine-win-x64
cd ../downloads && sha256sum research-engine-<version>-* > SHA256SUMS
```

### Desktop app

```bash
npm run desktop:sidecar      # compile the server into the shell's resources
npm run desktop:check        # boots the compiled server and asserts it answers
npm run desktop:build        # Tauri bundles: NSIS on Windows, deb/AppImage on Linux
```

CI (`.github/workflows/desktop.yml`) builds those bundles on every version tag,
boots the compiled server on the runner, verifies the installer before uploading,
and attaches the artifacts to the release. **Windows and Linux only — no macOS
runner is configured.**

## The website

`website/` is the public site: what the app does, what people said, why it is
free, and the download. It is a static Vite page — no functions, no server, no
secrets — built from the SmoothUI, Aceternity UI and shadcnspace registries the
rounds name.

```bash
npm run site:dev       # vite dev server on :5188 (npm --prefix website run dev)
npm run site:build     # → website/dist
npm run site:test      # 78 checks, mounted in jsdom
npm run site:vendor    # re-verify the vendored files against their digests
```

Two things are worth knowing before touching it:

- **Every component is vendored with provenance.** `website/scripts/
  site-sources.json` records each file's origin, the digest it was vendored from,
  the digest as it sits in this repository, and every local edit with the reason
  it exists. `site-vendor.mjs --verify` re-checks all of it offline and re-fetches
  the upstream copy when the network allows, so a mismatch is reported rather than
  silently absorbed. Do not edit a vendored file without recording the patch and
  the new digest.
- **The download is generated from this repository, not typed by hand.**
  `website/scripts/prepare-assets.mjs` runs before Vite on every dev start and
  build: it reads the version from the root `package.json`, copies the portable
  archives out of `downloads/`, reads their digests from `SHA256SUMS` and the
  installer digests from `INSTALLERS.sha256`, and writes
  `website/public/release.json`. The installers link to the GitHub release for
  that exact tag; the portables are served by the site itself. Nothing to keep in
  sync by hand — but it does mean **the site only shows a new version after it is
  rebuilt and redeployed**, so a release is not finished until the site has been
  rebuilt (a push to the branch, or "Trigger deploy" in Netlify).

Deploying: connect the repository in Netlify and accept the defaults. The root
`netlify.toml` sets the base directory to `website`, the command to
`npm ci && npm run build`, the publish directory to `dist`, the SPA fallback, the
cache headers for hashed assets and images, and `NODE_VERSION=22`.

The screenshots are this repository's own. `.github/workflows/site-assets.yml` is
a maintainer-run job (push a `site-assets-*` tag) that fetches the originals onto a
scratch branch, because the build environment this branch is developed in cannot
reach an image host; the optimisation to 1600 px WebP happens where ImageMagick
is available, and only the WebP files are committed.

## Releases

1. Bump the version in `package.json`, `frontend/`, `backend/`, `desktop/` and `desktop/src-tauri/`.
2. Rebuild, re-run the suites, and package the archives into `downloads/` with `SHA256SUMS`.
3. Run the bench against the packaged build and write the report next to it.
4. Write `downloads/release-notes-<version>.md` — that file becomes the release body.
5. Tag `v<version>` and push the tag; CI builds and attaches the installers.
6. Record each installer's SHA-256 (GitHub reports it on the asset itself) in `downloads/INSTALLERS.sha256`.

## Performance tuning

Three profiles cap concurrency to match the machine:

| Profile | Flood workers | Search results | Concurrent streams | Background tasks |
|---|---|---|---|---|
| `eco` | 1 | 5 | 1 | off |
| `balanced` | 2 | 7 | 2 | on |
| `performance` | 4 | 9 | 4 | on |

```bash
npm start -- --profile eco            # Raspberry Pi, 1 GB VPS
npm start -- --profile performance    # workstation, always-on server
```

Additional levers, all in Settings:

- **AIFlowEngine mode** — Fidelity trades token savings for full context; Efficient maximises savings.
- **Stream shaping** — `off` renders raw tokens (fastest); `cinematic` maximises readability.
- **High-memory mode** — adds one worker and one concurrent stream when RAM is plentiful.
- **Semantic cache** — repeat and near-repeat queries answer from the local cache without touching a provider.
- **Per-provider timeout** — how long *this app* waits before giving up on a provider, in seconds, per provider card.

Long chats use windowed rendering (`content-visibility`), heavy routes load on
demand, and the initial bundle is code-split. Entry bundle on the current release:
about 1.0 MB (≈322 kB gzipped).

## Data on disk

| Path | Contents |
|---|---|
| `~/.research-engine/db.sqlite` | Chats, notebooks, documents, quizzes, articles, skills, workflows |
| `keys.enc` | Provider keys, AES-GCM encrypted with your passphrase |
| `notebooks/`, `media/`, `cache/` | Your files, fetched images, caches |
| `config.json` | Remembered port and profile |
| `<data-dir>/projects/` | Coding projects |

Override the location with `RESEARCH_ENGINE_DATA_DIR`. The updater is forbidden
from touching this directory by design.

## Troubleshooting

**1. The port is already in use.** The server picks the next free port and
remembers it in `config.json`. Force one with `--port`; delete
`~/.research-engine/config.json` to reset.

**2. `better-sqlite3` fails to build.** A prebuilt binary is missing for your
platform. The server logs a warning and runs with an in-memory database for the
session; install build tools (python3, make, a C++ toolchain) and reinstall for
persistent storage. On Node 22.5+ this does not apply — the built-in SQLite is used.

**3. A provider returns 401 / invalid key.** Settings → Providers → re-run the
connection test, and check the base URL (OpenAI-compatible endpoints differ:
some want a `/v1` suffix, some do not).

**4. Search returns no results.** The search services were unreachable from your
network. Answers still work and say they are ungrounded; check outbound HTTPS, or
run your own SearXNG and point the app at it — the search panel has the field and
the docker one-liner for it.

**5. Ollama is not detected.** Detection probes `http://localhost:11434/api/tags`.
Confirm `ollama serve` is running and set a custom base URL in Settings if it
listens elsewhere.

**6. Streaming is choppy behind a proxy.** Turn off proxy buffering
(`proxy_buffering off;` in nginx) and raise `proxy_read_timeout` — see
[install.md](install.md#f-home-server-or-nas).

**7. Windows: "Cannot read properties of null" when creating a project.** Fixed in
0.21.1; project paths used to be validated with a POSIX separator that never
matches a Windows path. Update and it is gone.

**8. Something is broken and you need evidence.** Settings → Developer →
*Test: create a project* / *Test: create the sample app* runs the real path,
prints the request, status, response body and duration, then deletes what it made.
**Copy report** puts it on the clipboard.

**9. A fix is in the code but the app shows the old behaviour.** You are running an
older build. `./research-engine version` prints the served version and whether it
matches the code next to it; **Settings → About** shows the button to clear a
cached app shell and reload.

**10. Onboarding loops.** Its state lives in local storage for browser installs and
in the database for hosted ones. Clearing site data mid-onboarding restarts it;
complete it once and it does not return.

**11. Memory grows in long sessions.** Switch to the `eco` profile, turn off
High-memory mode, and keep AIFlowEngine on Efficient — context capsules keep
prompt size bounded and history hydrates on demand.

**12. A container restarts immediately.** `docker logs research-engine` — the usual
cause is a volume permission mismatch. The image runs as a non-root user and needs
write access to `/data`.

## Contributing

- File issues and ideas at [github.com/timetorepo/researchengine/issues](https://github.com/timetorepo/researchengine/issues).
- Before a pull request, run the TypeScript check for both workspaces, `render-check.mts` and `smoke.mts` at minimum, and say which suites you ran.
- House rules the app itself follows, and so do we: no invented APIs, paths or test
  results; no TODOs, stubs or placeholder data in a delivered change; a numeric
  design bar for anything visual (contrast ≥ 4.5:1, a 4px spacing rhythm, real
  interactive states, 150–300ms motion).
