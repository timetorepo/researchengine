# Prebuilt downloads

Ready-to-run builds ship inside the source archive itself (release-asset
uploads are not available from every build environment). Both archives are
pure-JS portable builds: the only requirement on your machine is Node.js.

| File | Platform | Needs |
|---|---|---|
| `research-engine-0.16.0-beta.1-win-x64.zip` | Windows 10/11 x64 | Node.js 20+ (LTS recommended; 22.5+ for persistent storage) |
| `research-engine-0.16.0-beta.1-linux-x64.tar.gz` | Linux x64 | Node.js 20+ (same note) |

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
tar xzf research-engine-0.16.0-beta.1-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
./research-engine-linux-x64/research-engine serve --port 3847
```

Then open http://127.0.0.1:3847. Data lives in `~/.research-engine`
(override with `RESEARCH_ENGINE_DATA_DIR`). systemd / launchd service
templates are in the root README, install method C.

## Other platforms / newer builds

Regenerate the portable folder for your own platform at any time:

```bash
node scripts/package-binary.mjs --out release            # this machine
node scripts/package-binary.mjs --out release --target win-x64   # cross-package
```
