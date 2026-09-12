# Prebuilt downloads

This folder ships a ready-to-run build so the portable artifact travels with
the source archive itself (release-asset uploads are not available from every
build environment).

## research-engine-0.14.0-beta.1-linux-x64.tar.gz

A self-contained portable build for Linux x64: launcher, bundled server,
production dependencies, and the built frontend. Requires only Node 20+ on
the target machine. Verified by launching it outside the repository and
serving the app and API.

Install:

```bash
tar xzf research-engine-0.14.0-beta.1-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
./research-engine-linux-x64/research-engine serve --port 3847
```

Then open http://127.0.0.1:3847. Your data lives in `~/.research-engine`
(override with `RESEARCH_ENGINE_DATA_DIR`).

## Verify the checksum

```bash
sha256sum -c SHA256SUMS
```

## Other platforms / newer builds

Regenerate the portable folder for your own platform at any time:

```bash
node scripts/package-binary.mjs --out release
```

See the root README, install method C, for systemd / launchd / NSSM service
templates.
