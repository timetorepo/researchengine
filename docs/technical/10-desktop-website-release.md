# 10. Desktop, website and release

## Four ways to run the app

| Form | How it is built | Where it runs |
|---|---|---|
| **Source checkout** | `npm run dev` (dev) or `npm run build && npm start` | Any machine with Node |
| **Single container** | `Dockerfile.single` (one process serves the API and the built frontend, SQLite in `/data`); `docker-compose.yml` adds the optional SearXNG service | Docker |
| **Portable server** | `npm run package:binary`, which produces a self-contained server bundle | The platforms the build targets |
| **Desktop app** | Tauri 2 shell around a compiled sidecar | Windows, macOS, Linux |

Installation steps for end users are in [install.md](../install.md).

## The desktop app

`desktop/` is a thin Tauri 2 shell.

- `desktop/src-tauri/src/main.rs` starts the sidecar, polls `/api/health` over a raw
  socket until it answers, and only then points the window at it. Closing the app
  stops the sidecar.
- The sidecar is `scripts/desktop-sidecar.mjs`. It compiles the backend with Bun
  (`bun build --compile --minify --target=bun-<target>`) into one binary, so users
  do not need Node.
- `desktop/src-tauri/tauri.conf.json` holds the product name, version
  (`1.0.1`), identifier (`dev.researchengine.desktop`) and bundle targets.
- Cargo dependencies are only `tauri` and `tauri-build`. There is no opener plugin,
  which is why opening an external browser from the desktop app is a known issue
  ([known issues](14-known-issues.md)).

Local desktop builds need Rust and Cargo. Installers are built in CI.

## Continuous integration

`.github/workflows/`:

| Workflow | Trigger | What it does |
|---|---|---|
| `desktop.yml` | Tags `v*`, pull requests that touch `desktop/**` or the desktop scripts, and manual dispatch | Builds the sidecar and the Tauri installers and verifies them with `scripts/verify-installer.mjs`. A tag run produces the GitHub release. |
| `website.yml` | Pushes that change `website/**` or `netlify.toml` | Builds the website |
| `site-assets.yml` | Tags `site-assets-*` | Publishes the site's assets |

`desktop/ci/desktop.yml` is an older copy of the desktop workflow and differs from
`.github/workflows/desktop.yml`. Treat `.github/workflows/` as the source of truth.

## The website

`website/` is a static Vite site for the marketing page and downloads. It has its
own `package.json` (name `research-engine-website`). `website/src/lib/release.ts`
holds the version and download links. `website/scripts/prepare-assets.mjs` copies
the portable builds from `downloads/` and writes the release manifest before the
build. `netlify.toml` configures the deploy. The site has no functions, database
or secrets.

Commands: `npm run site:dev`, `npm run site:build`, `npm run site:test`, and
`npm run site:vendor` (which refreshes vendored assets).

## Release process

Releases are tagged with `vX.Y.Z`, and the tag triggers the desktop workflow. The
steps, as they have been followed:

1. Bump the version everywhere it appears. `grep -rn "1.0.1" --include=*.json
   --include=*.toml --include=*.ts --include=*.html --include=*.md` finds them all:
   the root, backend, desktop and frontend `package.json` files and their lock
   files, `desktop/src-tauri/Cargo.toml` and `tauri.conf.json`,
   `website/index.html`, `website/src/lib/release.ts`, `README.md`, and
   `downloads/`.
2. Write release notes in `downloads/release-notes-X.Y.Z.md`.
3. Commit, then push an annotated tag `vX.Y.Z`.
4. Wait for `desktop.yml` to finish. It produces the installers, the checksums
   (`SHA256SUMS`) and the GitHub release.
5. Check the release page and the checksums before announcing.

Rules that have been learned the hard way:

- **Never move or re-tag a published version** unless the maintainer asks. Users and
  checksums depend on the tag.
- A GitHub Actions run with zero steps means the account is out of minutes, not that
  the workflow is broken.
- `gh workflow run` may be refused by permissions; a tag push is the reliable trigger.
- Do not regenerate the whole changelog. It renames older versions.

The generated `downloads/SHA256SUMS` and `downloads/INSTALLERS.sha256` are the files
the updater trusts. Keep them with the release.
