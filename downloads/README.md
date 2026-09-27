# Prebuilt downloads

Ready-to-run builds ship inside the source archive itself (release-asset
uploads are not available from every build environment). Both archives are
pure-JS portable builds: the only requirement on your machine is Node.js.

Prefer an installer? **0.28.0** also ships the **Tauri desktop app** — Windows
gets a per-user `setup.exe` (no Node, no Electron, WebView2 fetched
automatically), Linux a `.deb`/`.AppImage`, macOS a `.dmg`. CI builds them from
this tag and attaches them to the release you are reading; their hashes are in
`INSTALLERS.sha256` in this folder — taken from the reading CI published for the
files it built and verified, cross-checked against the byte counts of the
uploaded assets. A freshly built installer is never claimed here before it
exists; these ones do.

Full hashes: `INSTALLERS.sha256` in this folder.

See `desktop/README.md` for how the shell boots the local server, and
`.github/workflows/desktop.yml` for the build.

| File | Platform | Needs |
|---|---|---|
| `research-engine-0.28.0-beta.1-win-x64.zip` | Windows 10/11 x64 | Node.js 20+ (LTS recommended; 22.5+ for persistent storage) |
| `research-engine-0.28.0-beta.1-linux-x64.tar.gz` | Linux x64 | Node.js 20+ (same note) |

Verify either archive first:

```bash
sha256sum -c SHA256SUMS
```

## Windows

1. Install Node.js LTS from https://nodejs.org if you do not have it.
2. Extract the zip anywhere, e.g. `C:\Apps\research-engine-win-x64`.
3. Open a terminal in that folder and run:

```bat
research-engine.cmd serve --port 3847
```

4. Open http://127.0.0.1:3847

Your data is stored in `%USERPROFILE%\.research-engine` and survives
restarts on Node 22.5+ (the server uses Node's built-in SQLite; no native
modules are required). To run it as a background service, register the
launcher with NSSM — see the root README, install method C.

## Linux / macOS

```bash
tar xzf research-engine-0.28.0-beta.1-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
./research-engine-linux-x64/research-engine serve --port 3847
```

Then open http://127.0.0.1:3847. Data lives in `~/.research-engine`
(override with `RESEARCH_ENGINE_DATA_DIR`). systemd / launchd service
templates are in the root README, install method C.

## Does it actually work on this machine?

`bench-report-0.28.0-beta.1.txt` is the output of the Developer bench
(`npx tsx frontend/scripts/bench-report.mts`) run against this exact build: it
created a project and the sample app through the real API and deleted both
again, with the status codes and timings in the file. The same function backs the
two buttons in Settings → Developer, so what the file says is what those buttons
would say on your machine.

## Which build am I running?

Ask the launcher:

```bash
./research-engine version      # or: research-engine.cmd version
```

```
Research Engine 0.28.0-beta.1  [portable]
  built frontend : 0.24.0-beta.1 (2026-09-26T06:44:02.114Z)
  STATUS         : STALE — the served build is 0.24.0-beta.1 but this code is 0.28.0-beta.1
                   fix: unpack the current release archive over this folder
```

Every archive ships a `frontend-dist/build-info.json`, the server prints the
same fingerprint at startup, `/api/health` reports it, and **Settings -> About**
shows it with a warning card if the bundle in your browser is older than the
build on disk. If the app still behaves like an older release, you are on an
older build: unpack the current archive over this folder (your data in
`~/.research-engine` is untouched) or press **Clear cache & reload** on the About
screen to drop a cached app shell.

## Other platforms / newer builds

Regenerate the portable folder for your own platform at any time:

```bash
node scripts/package-binary.mjs --out release            # this machine
node scripts/package-binary.mjs --out release --target win-x64   # cross-package
```
