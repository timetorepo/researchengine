# Prebuilt downloads

Ready-to-run builds ship inside the source archive itself (release-asset
uploads are not available from every build environment). Both archives are
pure-JS portable builds: the only requirement on your machine is Node.js.

Prefer an installer? **0.32.0** also ships the **Tauri desktop app** — Windows
gets a per-user `setup.exe` (no Node, no Electron, WebView2 fetched
automatically) and Linux a `.deb`/`.AppImage`. There is no macOS build. CI builds them from
this tag and attaches them to the release you are reading; their hashes are in
`INSTALLERS.sha256` in this folder, and every one of them is **GitHub's own
sha256 digest for the uploaded asset**, read back from the release API
(`digest` on the asset), not a hash of a local build folder that could have
drifted. A freshly built installer is never claimed here before it exists.

| Installer | Platform | Size |
|---|---|---|
| `Research.Engine_0.32.0-beta.1_x64-setup.exe` | Windows 10/11 x64 (per-user) | 38.9 MB |
| `Research.Engine_0.32.0-beta.1_amd64.deb` | Debian/Ubuntu x64 | 47.3 MB |
| `Research.Engine_0.32.0-beta.1_amd64.AppImage` | any x64 Linux | 122.2 MB |

Full hashes: `INSTALLERS.sha256` in this folder.

See `desktop/README.md` for how the shell boots the local server, and
`.github/workflows/desktop.yml` for the build.

You only need to do this once: from 0.29.0 on, the app updates itself.
**Settings → Updates** checks the release list, verifies the archive against the
`SHA256SUMS` published with the same tag, and swaps the code in — your library in
`~/.research-engine` is never part of the swap, and a version that cannot start
on its own is rolled back automatically. Source checkouts are told to
`git pull && npm run build` instead, and the desktop app is handed the installer.

0.32.0 is the round that fixes the two things you could see failing, and adopts
the components that were asked for by name. **The update download works again:**
it was fetching the release file from a private repository without the token it
already had, and calling the one URL form a token cannot authenticate — the
committed copy at the tag is tried first now, uploaded assets are fetched by
their API URL, and a failure lists every source it tried. The desktop app no
longer insists on a platform installer that most releases do not publish; it
falls back to the verified portable archive and leaves a `HOW-TO-INSTALL` note
beside it. **`0.0.0-dev` is gone:** the version shown is the version running,
resolved from the build stamp and then from the server's own report. Release
notes render **inside the app** instead of behind a link to a private repo, a
new version **announces itself in a real HeroUI modal** (notes, download,
progress, restart, skip-this-version, once per version), and **Chats uses
HeroUI's real Tabs** for All / Research / Coding. The home screen is minimal by
default — widgets and the offline-demo pill are off until asked for, Raycast's
wallpapers ship with the app, recent-work cards carry Border Beam, and pressing
send blurs the page into the chat. Settings and Tasks now animate out, and the
pomodoro timer no longer skips every other second or clip against the top of the
window.

0.31.0 is the round that made the composer honest: the mode popover closes on the
row you press (Escape, backdrop, scroll and resize close it too), the dictation
pill only offers Cancel while there is something to cancel, and the plug menu is a
real gateway — Drive, Gmail, Calendar, GitHub, Notion, Slack and your local files,
with credentials stored in your local vault, proven against the live service with
**Save & test**, and reachable by the agent through `integration_search` /
`integration_read`. It also fixes the one thing that was genuinely white: the
theme-matched gradients were mixed with the page colour, so on the light palettes
the cards and the Agent Flood Deploy pill washed out **under white type**.

0.30.0 answered the obvious question — *this repository is private, how does a
user read its releases at all?* **Settings → Updates → Where updates come from**
takes a **read-only token** (fine-grained, *Contents: read*; sent to GitHub and
nowhere else), or a **manifest URL** (any static JSON listing releases — a gist,
a bucket, your own server) if you would rather not hand out a token. And if you
already have the archive, **install from file** takes `.tar.gz`/`.tgz`/`.zip`
with the `SHA256SUMS` text, verifies the checksum before unpacking, and swaps it
exactly like a network update.

| File | Platform | Needs |
|---|---|---|
| `research-engine-0.33.0-beta.1-win-x64.zip` | Windows 10/11 x64 | Node.js 20+ (LTS recommended; 22.5+ for persistent storage) |
| `research-engine-0.33.0-beta.1-linux-x64.tar.gz` | Linux x64 | Node.js 20+ (same note) |

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

## Linux

```bash
tar xzf research-engine-0.33.0-beta.1-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
./research-engine-linux-x64/research-engine serve --port 3847
```

Then open http://127.0.0.1:3847. Data lives in `~/.research-engine`
(override with `RESEARCH_ENGINE_DATA_DIR`). systemd and NSSM service
templates are in [docs/install.md](../docs/install.md).

## Does it actually work on this machine?

`bench-report-0.33.0-beta.1.txt` is the output of the Developer bench
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
Research Engine 0.33.0-beta.1  [portable]
  built frontend : 0.33.0-beta.1 (2026-09-27T08:47:51.519Z)
  STATUS         : ok
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
