# Research Engine

**Your research, on your machine.** A self-hosted, privacy-first research platform with Perplexity-level answer quality — bring your own API keys, keep every byte of your data local.

![Research Engine screenshot](docs/screenshot.png)

[![Pre-release](https://img.shields.io/badge/release-v0.14.0--beta.1-blue)](https://github.com/timetorepo/researchengine/releases)
[![License](https://img.shields.io/badge/license-all%20rights%20reserved-lightgrey)](#license--credits)
[![Platforms](https://img.shields.io/badge/platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux%20%C2%B7%20Web-success)](#install-research-engine)

---

## What this is

Research Engine is a complete research workstation you run yourself. Ask a question and it classifies the query, searches the web when that helps, grounds the answer in retrieved sources with inline citations, and streams a response shaped like composed prose — not a wall of tokens. Everything you produce (chats, notebooks, documents, quizzes, articles, skills, workflows) lives in one local directory you own.

It is built for researchers, scientists, students, analysts, and privacy-conscious power users who want frontier-quality AI assistance without handing their thinking to a hosted service. If your work involves sensitive, proprietary, or regulated material, this is the design point: your content never touches a Research Engine server — there are no Research Engine servers.

What makes it different: (1) **local by architecture, not by promise** — SQLite storage, local caches, and local notebooks on disk you can open, back up, or delete; (2) **bring your own keys** — OpenAI-compatible providers, Anthropic, Google Gemini, Ollama, NVIDIA NIM, or anything compatible, your choice and your cost ceiling; (3) a genuine **optimization engine (AIFlowEngine)** that classifies every query, prunes context into compact capsules, and paces token delivery so streaming feels written, not dumped.

---

## Feature summary

| | Feature | What you get |
|---|---|---|
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C8EEF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> | **Grounded answers** | Web search (DuckDuckGo/Bing backends), numbered source citations, per-source reading, answers that cite inline |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> | **AIFlowEngine** | Query classification, context pruning (40–70% token savings), semantic caching, and stream shaping with four pacing modes |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7M14 17.5h7"/></svg> | **Workflow editor** | Node-based automation: triggers, AI steps, logic, transforms, and outputs on an infinite canvas, with run history and one-file sharing |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> | **Read & Quiz studio** | Upload PDF/DOCX/TXT, a 720px study reader with highlights, AI summaries, and generated quizzes (6 question types, timer, streaks) — runs fully offline |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> | **Agent Flood** | Point a swarm of agents at a topic; each agent researches in parallel and files findings into your notebook |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> | **Articles & notebooks** | Long-form editor with AI blocks and Wikimedia-sourced imagery, plus a private notebook for retrieval-grounded chats |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> | **Private vault** | API keys encrypted at rest (AES-GCM with a passphrase-derived key) in your data directory — never in a browser sync service |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> | **Runs anywhere** | One process on a laptop, a Raspberry Pi, a NAS, or a container; installable as a PWA; desktop app via Tauri |

---

## Quick start

The fastest way to a running instance — no Docker, no account:

```bash
git clone https://github.com/timetorepo/researchengine.git
cd researchengine
npm install
npm run build
npm start
```

Open **http://127.0.0.1:3847**. The first launch walks you through onboarding: pick a theme, add at least one provider (an API key, a local Ollama, or skip and use the built-in on-device demo model), and set your first master prompt.

> **No API key?** Research Engine ships with an on-device demo model so every surface — chat, search, quiz, flood — works fully offline. Real providers plug in later, at any time.

Prefer the development loop with hot reload instead:

```bash
npm install
npm run dev        # frontend on :5173, API on :8787, proxied together
```

---

## Install Research Engine

Seven first-class installation paths, ordered lightest to heaviest. Pick the first one that fits your situation; every path runs the same product.

| Method | Weight | Where it runs | Best for |
|---|---|---|---|
| **A. PWA** | lightest | Any Chromium browser; Safari/Firefox with limits | Trying it in a minute |
| **B. Desktop app (Tauri)** | light | macOS / Windows / Linux | Daily-driver laptop experience |
| **C. Native binary** | light | Windows / Linux / macOS with Node 20+ | Servers & desktops without containers |
| **D. From source** | medium | Anywhere Node 20+ runs | Contributors and tinkerers |
| **E. Docker, single container** | heavier | Any Docker host | Container-first setups |
| **F. Docker Compose** | heavier | Any Docker host | Multi-service stacks (SearXNG, etc.) |
| **G. Home server / NAS** | varies | Synology, Unraid, TrueNAS, Raspberry Pi | Always-on household research box |

### A. Progressive Web App (PWA)

**What it is.** Research Engine's web build is a full PWA: installable, offline-capable via its service worker, and indistinguishable from a local app inside Chromium browsers.

**Best for.** A zero-install trial, shared lab machines, or hosting once on a Raspberry Pi and installing it on every device in the house.

**Requirements.** Chromium-based browser (Chrome, Edge, Arc, Brave) for full install support. Safari installs via "Add to Home Screen" with reduced background behavior. Firefox can pin the app but does not offer full PWA installation — this is a Firefox platform limitation, not a Research Engine one.

**Install.** Point the browser at a running instance (see methods C–G for hosting one), then:

```text
Chrome / Edge :  address-bar install icon  ->  Install
               or  menu -> Save and share -> Install Research Engine
Safari        :  File -> Add to Home Screen (or Share on iOS)
```

**Run.** Launch from the OS app list like any native app. Your data lives in the browser profile of the machine you installed it on.

**Update.** Updates ship with the server. The service worker refreshes on next visit; force an immediate update from DevTools -> Application -> Service Workers if a page seems stale.

**Uninstall.** OS app list -> right-click -> Uninstall, or clear the site data for your instance URL.

### B. Desktop app (Tauri)

**What it is.** A native window wrapping the same engine: system tray, global hotkey, native file dialogs, OS keychain-friendly secret storage, and start-at-login. The shell lives in `desktop/` of this repository.

**Best for.** The recommended default for laptop and desktop users who want Research Engine one keystroke away.

**Requirements.** For prebuilt installers: none — install and run. To build installers yourself (or on a platform without prebuilts): Rust 1.80+, the Tauri CLI, and the platform toolchain (Xcode command-line tools on macOS, WebView2 on Windows — preinstalled on Windows 11, GTK/webkit2gtk on Linux).

**Install.** Download the asset for your platform from the release page and verify its checksum before running:

| Platform | Asset | Notes |
|---|---|---|
| macOS | `ResearchEngine_<ver>_aarch64.dmg`, `_x64.dmg` | Apple Silicon and Intel builds; notarization pending for early betas — right-click -> Open the first time |
| Windows | `ResearchEngine_<ver>_x64-setup.exe` | Installer; an NSIS-free portable `.zip` is also published |
| Linux | `.AppImage`, `.deb`, `.rpm`, Flatpak manifest, AUR package | AppImage needs `chmod +x` and FUSE |

```bash
shasum -a 256 ResearchEngine_0.15.0-beta.1_aarch64.dmg   # compare with the SHA256SUMS on the release
```

**Run.** Launch from the applications menu. The app starts the local backend automatically; close-to-tray keeps it warm.

**Update.** In-app update prompt when a new pre-release is published, or download the new installer over the old one.

**Uninstall.** Standard OS removal (drag out of Applications / Add or remove programs / your package manager). Your data directory (`~/.research-engine`) is left untouched — delete it manually for a complete wipe.

### C. Native binary (portable folder)

**What it is.** The lightest self-hosted option that includes the backend: a portable folder containing the launcher, the bundled server, and the built frontend. No container, no Node install required on the host when built with Bun; with the Node launcher, Node 20+ on the host is required.

**Best for.** A VPS, a home lab box, or any machine where you want one folder and one process.

**Requirements.** Windows 10/11 (x64), Linux (x64/arm64), or macOS. Node.js
20+ on the host; Node 22.5+ is recommended because the server then persists
data using Node's built-in SQLite — no native modules to compile on any
platform.

**Install.** Prebuilt archives for **Windows x64** and **Linux x64** ship
inside the repository under `downloads/`, so the source download is ready to
run. Verify the checksum, then unpack for your platform:

```bash
cd downloads
sha256sum -c SHA256SUMS
```

Windows — extract `research-engine-0.15.0-beta.1-win-x64.zip`, then in that
folder:

```bat
research-engine.cmd serve --port 3847
```

Linux — unpack and run:

```bash
tar xzf research-engine-0.15.0-beta.1-linux-x64.tar.gz
chmod +x research-engine-linux-x64/research-engine
```

To produce a folder for another platform (macOS, arm64), or a Bun-compiled
launcher, build it from source on any machine with Node 20+ (or Bun):

```bash
node scripts/package-binary.mjs                          # -> release/research-engine-<os>-<arch>/
node scripts/package-binary.mjs --target win-x64         # cross-package a Windows folder
node scripts/package-binary.mjs --bun                    # single-file launcher via bun when present
```

Optionally add the launcher to your PATH:

```bash
ln -s "$PWD/research-engine-linux-x64/research-engine" ~/.local/bin/research-engine
```

**Run.** Foreground:

```bash
./research-engine serve --port 3847 --profile balanced
```

As a systemd service (`/etc/systemd/system/research-engine.service`):

```ini
[Unit]
Description=Research Engine
After=network-online.target

[Service]
User=research
WorkingDirectory=/opt/research-engine
ExecStart=/opt/research-engine/research-engine serve --port 3847 --profile eco
Restart=on-failure
RestartSec=3
Environment=RESEARCH_ENGINE_DATA_DIR=/var/lib/research-engine

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now research-engine
```

On macOS, use launchd (`~/Library/LaunchAgents/com.researchengine.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.researchengine</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/research-engine/research-engine</string>
    <string>serve</string><string>--port</string><string>3847</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
</dict>
</plist>
```

```bash
launchctl load ~/Library/LaunchAgents/com.researchengine.plist
```

On Windows, register the launcher as a service with NSSM:

```bat
nssm install ResearchEngine C:\opt\research-engine-win-x64\research-engine.cmd serve --port 3847
nssm start ResearchEngine
```

**Update.** Unpack the new folder beside the old one, stop the service, point `ExecStart` at the new folder, start the service. Your data directory is separate and survives untouched.

**Uninstall.** Stop and disable the service, delete the folder, and optionally delete `~/.research-engine` (your data).

### D. From source

**What it is.** The repository itself: an npm-workspaces monorepo (Vite + React frontend, Hono backend, SQLite storage).

**Best for.** Contributors, tinkerers, and anyone who wants hot reload or plans to patch the product.

**Requirements.** Node 20 or newer with npm 10+. Bun 1.1+ and pnpm 9+ also work (Bun: `bun install && bun run build && bun start`; pnpm: enable `enable-pre-post-scripts` and use the same script names).

**Install.**

```bash
git clone https://github.com/timetorepo/researchengine.git
cd researchengine
npm install
```

**Run.** Development (hot reload, frontend on `:5173` proxying the API on `:8787`):

```bash
npm run dev
```

Production (single process serving the built frontend and API on `:3847`):

```bash
npm run build
npm start
```

**Update.**

```bash
git pull
npm install
npm run build
```

Restart the process. The SQLite schema is versioned; existing data carries forward.

**Uninstall.** Delete the repository folder. Delete `~/.research-engine` to remove your data.

### E. Docker, single container

**What it is.** One slim Alpine image containing the built frontend, the server bundle, and SQLite.

**Best for.** Setups where everything must run in a container, or where you want hard resource limits. Docker is fully optional — Research Engine runs lighter without it (see methods B–D).

**Requirements.** Docker 24+ on any supported host.

**Install.**

```bash
docker build -f Dockerfile.single -t research-engine .
```

Or pull the published image when one is attached to a release.

**Run.**

```bash
docker run -d --name research-engine \
  -p 3847:3847 \
  -v re-data:/data \
  -e RE_PROFILE=balanced \
  --memory 512m --cpus 1 \
  research-engine
```

The image runs as a non-root user, exposes a healthcheck, and stores everything under `/data`.

**Update.**

```bash
docker pull research-engine:latest   # or rebuild from source
docker rm -f research-engine
# re-run the command above; the re-data volume keeps your data
```

**Uninstall.**

```bash
docker rm -f research-engine
docker rmi research-engine
docker volume rm re-data      # warning: deletes all your data
```

> **Limits.** The single container embeds SQLite — that is intentional and fine for a personal instance. It does not include GPU acceleration, a bundled search sidecar, or multi-process scaling; use method F for those.

### F. Docker Compose (advanced)

**What it is.** A multi-container stack: Research Engine plus optional services such as a self-hosted SearXNG instance for fully local web search.

**Best for.** Home-lab operators who want search to stay on their network too, or who enforce per-service resource caps.

**Requirements.** Docker with the Compose plugin.

**Install.** A minimal commented file:

```yaml
# compose.advanced.yml
services:
  app:
    build: { context: ., dockerfile: Dockerfile.single }
    ports: ["3847:3847"]
    environment:
      RE_PROFILE: balanced          # eco | balanced | performance
      SEARXNG_URL: http://searxng:8080   # consumed by the search backend when reachable
    volumes:
      - re-data:/data
    deploy:
      resources:
        limits: { memory: 512M, cpus: "1" }
    depends_on: [searxng]

  searxng:
    image: searxng/searxng:latest
    # internal only — no ports published; the app reaches it over the compose network
    volumes:
      - ./searxng:/etc/searxng

volumes:
  re-data:
```

A slim single-service compose file (`compose.slim.yml`) ships in the repository for the simpler case.

**Run.**

```bash
docker compose -f compose.advanced.yml up -d
```

**Update.**

```bash
git pull
docker compose -f compose.advanced.yml pull
docker compose -f compose.advanced.yml up -d --build
```

**Uninstall.**

```bash
docker compose -f compose.advanced.yml down -v   # -v deletes the data volume
```

### G. Home server / NAS

**What it is.** Research Engine as an always-on household service behind your existing infrastructure: Synology, Unraid, TrueNAS SCALE, or a Raspberry Pi 4/5.

**Best for.** One install the whole household (or team) reaches over HTTPS, from any device, including installed PWAs.

**Requirements.** Any of the above with container support, plus a reverse proxy for TLS (Caddy recommended — automatic HTTPS; nginx if you prefer it).

**Install.** On Synology use Container Manager -> Project and paste the compose file from method F. On Unraid add a container from the Docker tab using image `research-engine` and a mapped appdata volume. On TrueNAS SCALE use the Apps -> Custom App compose dialog. On a Raspberry Pi, method C (native binary, arm64) is the lightest route:

```bash
node scripts/package-binary.mjs      # on the Pi itself, or cross-build and copy
```

**Run.** Publish only the reverse proxy. Caddy:

```text
research.example.com {
    reverse_proxy localhost:3847
}
```

nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name research.example.com;
    # ssl_certificate / ssl_certificate_key ...

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_buffering off;              # required for token streaming
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_read_timeout 600s;
    }
}
```

For private-network access without opening ports, put the box on **Tailscale** or **WireGuard** and point the proxy at the tailnet hostname instead of a public domain.

**Update.** Same as the underlying method (compose pull / new binary folder), then restart the container or service.

**Uninstall.** Remove the container/project and its volume; on a Pi, remove the service and folder per method C.

---

## First run & configuration

1. **Onboarding** walks you through theme, motion preferences, and provider setup. Every step is skippable and re-runnable from Settings.
2. **Providers.** Settings -> Providers. Add an OpenAI-compatible endpoint (including NVIDIA NIM and local Ollama), Anthropic, Google Gemini, or paste nothing and rely on the demo model. Keys are stored encrypted in your data directory behind your vault passphrase.
3. **Master prompts.** The system prompts that shape every answer are versioned and readable in Settings -> Prompts. Defaults are locked-good; user overrides are visually marked, and a diff shows exactly what changed.
4. **AIFlowEngine.** Settings -> Flow. Choose the token-pruning mode (Efficient / Balanced / Fidelity), the stream-shaping mode (Off / Subtle / Standard / Cinematic), thinking-indicator verbosity, and pacing sensitivity.
5. **Performance profile.** `eco`, `balanced`, or `performance` — at launch via `--profile`, at runtime via Settings -> Performance.

---

## Data & privacy

Everything Research Engine writes lives in one directory: `~/.research-engine/` (override with `RESEARCH_ENGINE_DATA_DIR`).

| Path | Contents |
|---|---|
| `db.sqlite` | Chats, notebooks, documents, quizzes, articles, skills, workflows |
| `keys.enc` | AES-GCM encrypted provider keys |
| `notebooks/`, `media/`, `cache/` | Your files, fetched images, and caches |
| `config.json` | Remembered port and profile |

**What leaves the machine.** Only outbound calls to providers *you configured*, containing the prompts and context needed to answer. Web search calls go to the search backend you selected. Nothing else is transmitted: no telemetry, no analytics, no crash reports, no update pings.

| Platform | Where data lives | Notes |
|---|---|---|
| Single-process / native binary / source | `~/.research-engine` on the host | Back up the directory; that is the whole product |
| Docker | The `re-data` volume (`/data`) | `docker cp` or volume backup to extract |
| Desktop app | Same `~/.research-engine` | Deleting the app never deletes your data |
| PWA (pure browser mode) | The browser profile | Clearing site data clears it; prefer a hosted instance for durable work |

Backups: Settings -> Data produces a versioned ZIP of everything and merges it back on import.

---

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

- **AIFlowEngine mode** — Fidelity trades token savings for full context; Efficient maximizes savings.
- **Stream shaping** — `off` renders raw tokens (fastest), `cinematic` maximizes readability.
- **High-memory mode** — adds one worker and one concurrent stream when RAM is plentiful.
- **Semantic cache** — repeat and near-repeat queries answer from local cache without touching a provider.

Long chats use windowed rendering (`content-visibility`), heavy routes load on demand, and the initial bundle is code-split — startup targets under 800 ms on commodity hardware.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Command palette |
| `Cmd/Ctrl + N` | New chat |
| `Cmd/Ctrl + Shift + N` | New web-search chat |
| `Cmd/Ctrl + B` | Toggle sidebar |
| `Cmd/Ctrl + M` | Toggle Math mode |
| `Cmd/Ctrl + F` | Toggle AIFlowEngine |
| `Cmd/Ctrl + Shift + A` | Open Agent Flood |
| `Cmd/Ctrl + Shift + S` | Settings -> Providers |
| `Cmd/Ctrl + ,` | Settings sheet |
| `Cmd/Ctrl + /` | This shortcuts list |
| `Esc` | Close the topmost overlay |

---

## Development

```text
researchengine/
├── frontend/        # React 18 + Vite + Framer Motion + Tailwind-style CSS vars
│   ├── src/lib/flow/        # AIFlowEngine: classifier, pruner, cache, engine
│   ├── src/lib/providers/   # OpenAI-compatible / Anthropic / Ollama streaming
│   └── scripts/             # smoke.mts, nav-repro.mts, engine-test.mts
├── backend/         # Hono + SQLite (better-sqlite3 with in-memory fallback)
├── desktop/         # Tauri 2 shell (Rust) + packaging config
├── scripts/         # package-binary.mjs, dev.mjs
├── Dockerfile.single
└── compose.slim.yml
```

Daily loop:

```bash
npm run dev                     # hot reload, both servers
npm run smoke                   # functional smoke suite (frontend/scripts/smoke.mts)
```

Verification gates used on every release: TypeScript strict check, production build, the functional smoke suite, a jsdom navigation harness, and headless engine tests for stream shaping. Pre-releases are tagged only after all gates pass against a running instance.

Packaging:

```bash
node scripts/package-binary.mjs          # portable native folder
npm run build && npm start               # single-process verification
```

---

## Troubleshooting

**1. The port is already in use.** The server picks the next free port automatically and remembers it in `config.json`. Force a specific port with `--port`; delete `~/.research-engine/config.json` to reset the remembered value.

**2. `better-sqlite3` fails to build.** A prebuilt binary is unavailable for your platform. Research Engine logs a warning and falls back to an in-memory database for the session; install build tools (python3, make, a C++ toolchain) and reinstall to get persistent SQLite.

**3. A provider returns 401 / invalid key.** Open Settings -> Providers, re-run the connection test, and confirm the key and base URL (OpenAI-compatible endpoints vary: `/v1` suffixes differ between providers).

**4. Web search returns placeholder results.** The search backends were unreachable from your network. Answers still work and are labeled as ungrounded; check outbound HTTPS/443, or point search at your own SearXNG via method F.

**5. Ollama is not detected.** Detection uses a 200 ms probe of `http://localhost:11434/api/tags`. Confirm Ollama is running (`ollama serve`) and listening on the default interface; set a custom base URL in Settings if it is not.

**6. Streaming feels choppy behind a proxy.** Disable proxy buffering (`proxy_buffering off;` in nginx) and raise `proxy_read_timeout` — see the reverse-proxy examples above.

**7. The PWA shows an old version.** The service worker updates on navigation; force-update it from DevTools -> Application -> Service Workers, or unregister and reinstall.

**8. Onboarding loops.** Onboarding state lives in local storage for browser installs and in the database for hosted ones; clearing site data mid-onboarding restarts it. Complete it once and it never re-appears.

**9. Memory grows during long sessions.** Switch to the `eco` profile, disable High-memory mode, and keep AIFlowEngine on Efficient — context capsules keep prompt size bounded, and history hydrates on demand.

**10. Docker container restarts immediately.** Check `docker logs research-engine`; the usual cause is a volume permission mismatch — the image runs as a non-root user and needs write access to `/data`.

---

## FAQ

**Is this affiliated with Perplexity?** No. The bundled "Perplexity" theme is an aesthetic homage only. Research Engine is an independent product.

**Do I need an API key to try it?** No. The on-device demo model powers every surface offline. Add providers whenever you want real-model answers.

**Where do my chats live?** In `~/.research-engine/db.sqlite` on the machine running the server. Export everything as a ZIP from Settings -> Data.

**How is this different from running any chat UI against my key?** Query classification, context pruning, grounded web search, notebooks, quiz generation, agent swarms, workflows, and stream shaping — as one integrated product rather than a prompt box.

**Can multiple people share one instance?** Yes — it is a household/team server. Each browser keeps its own UI state; the shared backend stores the workspace.

**Does it work offline?** Fully, with the demo model and cached content. Live web search and real providers need connectivity by definition.

**What does "beta" mean here?** Pre-release versions are functionally verified before tagging, but storage formats may still evolve between minor versions. Keep using Settings -> Data backups.

**How do I contribute?** File issues, read the development section above, and run the smoke suite before opening a pull request.

---

## License & credits

Copyright (c) 2026 Research Engine contributors. All rights reserved. Pre-release builds are provided for evaluation; no license is granted beyond running the software as distributed.

Built on the shoulders of excellent open source: React, Vite, Hono, Zustand, Framer Motion, esbuild, KaTeX, pdf.js, Mammoth, Lucide, better-sqlite3, and Tauri. Their licenses travel with their packages.
