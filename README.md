# Research Engine

**Your research, on your machine.** A self-hosted, privacy-first research platform with Perplexity-level answer quality — bring your own API keys, keep every byte of your data local.

![Research Engine screenshot](docs/screenshot.png)

[![Pre-release](https://img.shields.io/badge/release-v0.30.0--beta.1-blue)](https://github.com/timetorepo/researchengine/releases)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license--credits)
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
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> | **Read & Quiz studio** | Upload PDF/DOCX/TXT, a 720px study reader with highlights, AI summaries, and generated quizzes (6 question types, timer, streaks). Step-by-step text is tidied **by the app, at display time** — `:dot:` lines, "Step 2 —" runs and repeated `1.` numbering become real numbered steps and bullets, with no extra model call. Selecting text **paints the highlight immediately** (the mark animates on like a marker; a chip offers *quiz this passage* or *undo*), paragraphs settle in as pages, jumps pulse the destination, and all of it stands down under reduce-motion. Runs fully offline |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg> | **Focus timer that knows the context** | A pill in the top bar that **morphs into a rounded block**: time left, a progress bar, pause/play/skip/reset — and a label saying what it is timing (*Quiz*, *Coding*, *Reading*), because a bare countdown tells you nothing. Pairs with focus sessions and the Dynamic Island |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M9 9h6v6H9z"/></svg> | **A dock, and toasts that live** | The collapsed sidebar becomes a **dock** — icons swell under the pointer, neighbours lean away, names fly out. Toasts are drawn by **Sonner** — hover pauses them, they stack and collapse, you can swipe them away — wearing the app's existing toast: the same blurred glass card (which follows Settings → Appearance → Glass mode), one tone-coloured icon, a quiet X |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg> | **Skills that hold a standard** | Three built-ins ship with the app: **UI/UX design pass** (hierarchy, a 4px spacing rhythm, contrast ≥ 4.5:1, every interactive state, 150–300ms motion, and a self-score that must clear 8/10 per axis), **Zero-hallucination pass** (verify every API, path and version against the real project; never invent a test result; end with an uncertainty list) and **No-filler implementation** (complete code only — no TODOs, stubs, dead branches or placeholder data — with a line-by-line review of its own diff) |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6C8EEF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/></svg> | **Profile & blobatar** | Settings → Profile sets your name, handle and bio. The avatar is a **blobatar** generated from your handle ([blobatar.dev](https://blobatar.dev)) — same handle, same creature, on any machine — with shape, motion, expression, colour and a re-roll row. Stored locally, no account |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/></svg> | **Interface craft** | The home chatbox wears **Border Beam** and thinking states use **Orbs**, both by [Jakub Antalik](https://jakubantalik.com); components also come from ReactBits, HeroUI and Aceternity UI. Every one is credited in Settings → About, alongside the MIT license |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> | **Agent Flood** | Point a swarm of agents at a topic; each agent researches in parallel and files findings into your notebook |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F472B6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> | **Articles & notebooks** | Long-form editor with AI blocks and Wikimedia-sourced imagery, plus a private notebook for retrieval-grounded chats |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> | **Private vault** | API keys encrypted at rest (AES-GCM with a passphrase-derived key) in your data directory — never in a browser sync service |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/></svg> | **Humanize** | One click after any answer: the AI rewrites its own reply so it reads like a person wrote it — uneven rhythm, plain vocabulary, no detector bait — while every fact, number and citation stays put. The rewrite shows in **green**, the previous response stays in **red** behind a hover tooltip (and one click away inline). Chat only; never inside Coding mode |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/></svg> | **Coding mode** | A VS Code-style workspace over local projects: file explorer, tabs, syntax-highlighted editor, guarded terminal, git panel, in-project search, and an AI pair-programmer that edits files with you. The IDE is skinned by *your* active theme, the project name renames inline on click, and the assistant runs as **Fix / Build / Refine** with a model of your choosing. Full screen (`Cmd/Ctrl + Shift + F`) folds the chat into a draggable floating pill. Project names are forgiving — spaces, capitals, emoji and punctuation all work, and characters Windows cannot store are cleaned up rather than rejected. Try a sample app always works — it never collides with an existing folder, and project creation can no longer be refused for its name (an empty name is named for you, a taken one is freed up). Coding mode also carries **house rules**: no invented APIs or paths, no fabricated results, no filler, and a numeric design bar. Create a project, upload a `.zip`/`.tar.gz`, or click **Try a sample app** |
| **Design mode** | The IDE runs your project's own dev server and embeds the live app. The AI can *see* the screen (structured DOM + geometry + colours + console), take real screenshots, pick/inspect elements, click and type through it, resize to phone/tablet widths, and prove fixes with assertions. Every control is also a one-click test button for you |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> | **Vision + tool calls** | Attach images for models that can see them; the AI can call tools — questionnaires, connectors, web search, files, commands, and MCP servers |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5a3.5 3.5 0 1 1 7 0c0 1.7-1 2.5-2 3.5h-3c-1-1-2-1.8-2-3.5z"/><path d="M12 2v2M4.9 4.9l1.4 1.4M2 12h2M19.1 4.9l-1.4 1.4M22 12h-2"/></svg> | **Connectors** | Local Files, Drive, Mail and Calendar you populate yourself — attach them in the chatbox or let the AI search them by tool call |
| <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> | **Privacy Shield** | Three postures — No Privacy, Privated (default), Top Secret — controlling outbound scanning and what may leave the device at all |
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

**What it is.** A native window (Tauri 2, the OS's own webview — WebView2 on Windows, WKWebView on macOS, WebKitGTK on Linux) around the same engine. The entire local server — API, SSE streams, documents, the Coding/Design preview manager — is compiled into **one self-contained executable**, so the app needs **no Node.js, no Electron and no browser** on your machine.

**Best for.** The recommended default on a laptop or desktop: double-click, and the app is there with everything local.

**How it starts.** The shell is deliberate about boot order:

1. Is a Research Engine server already answering on `127.0.0.1:3847`? Reuse it (that is the dev-server case, or a second launch of the app).
2. Otherwise spawn the server binary that sits next to the app, pointing it at the bundled UI (`FRONTEND_DIST`).
3. Poll `/api/health` over a socket until the server **answers** — a reachable port is not enough — then open the window at `http://127.0.0.1:3847/`.
4. When the window closes, that server process is stopped with it. One process tree, one life.

**Requirements.** None to install a prebuilt. To build one yourself: Rust stable, Node 20+ (`bun` is a devDependency and compiles the server), and on Linux `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`.

**Install.** Download the asset for your platform from the release page, and compare the checksum printed by CI for that build.

| Platform | Asset | Notes |
|---|---|---|
| Windows 10/11 x64 | `Research.Engine_<ver>_x64-setup.exe` | Per-user NSIS installer — no admin prompt, Start-menu entry, uninstaller; the WebView2 bootstrapper runs only if the machine does not already have it |
| Linux x64 | `Research.Engine_<ver>_amd64.deb`, `Research.Engine_<ver>_amd64.AppImage` | `sudo apt install ./…deb`, or `chmod +x …AppImage && ./…AppImage` |
| macOS | build from source — no macOS runner yet | `npm run desktop:build` on the Mac produces the `.dmg` |

```bash
sudo apt install ./Research.Engine_0.26.0-beta.1_amd64.deb
# or
chmod +x Research.Engine_0.26.0-beta.1_amd64.AppImage && ./Research.Engine_0.26.0-beta.1_amd64.AppImage
```

**Data.** The same `~/.research-engine` (`%USERPROFILE%\.research-engine` on Windows) SQLite database the web and portable builds use, so the desktop app, a browser tab and a portable copy all read the same library. Move the port with `RE_DESKTOP_PORT` if something else lives on 3847.

**Build it.** `npm install && npm run build && npm run desktop:sidecar && npm run desktop:check && npm run desktop:build` — output in `desktop/src-tauri/target/release/bundle/`. CI (`.github/workflows/desktop.yml`) builds the Windows and Linux installers on every tag and attaches them to the release; it boots the compiled server on the runner and verifies the installer's magic bytes, NSIS signature and size **before** uploading.

**Not included (yet).** No tray icon, no global hotkey, no auto-update, and no macOS notarization — the window, the local server and the installer are what this round ships.

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

Windows — extract `research-engine-0.17.0-beta.1-win-x64.zip`, then in that
folder:

```bat
research-engine.cmd serve --port 3847
```

Linux — unpack and run:

```bash
tar xzf research-engine-0.17.0-beta.1-linux-x64.tar.gz
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
4. **AIFlowEngine.** Settings -> Flow. Choose the token-pruning mode (Efficient / Balanced / Fidelity), the stream-shaping mode (Off / Subtle / Standard / Cinematic), thinking-indicator verbosity, pacing sensitivity, and the speed booster that keeps API models in the 1–4 second band.
5. **Performance profile.** `eco`, `balanced`, or `performance` — at launch via `--profile`, at runtime via Settings -> Performance.
6. **Connectors.** Settings -> Integrations -> Local connector data. Populate Drive (file upload), Mail and Calendar with your own data, then attach them from the plug icon in the chatbox or let the AI reach them by tool call.
7. **Coding.** Open Coding in the sidebar to create or upload a project (.zip / .tar.gz) — or press **Try a sample app** for a ready-made page with deliberate UI bugs. The AI assistant edits files with you, runs commands behind an approval gate, and talks git. Add MCP servers under Settings -> Coding & MCP.
8. **Design mode.** Inside a project press **Design mode** (or the monitor icon in the activity bar). The IDE starts the project's dev server, injects the design bridge, and shows the app in a preview pane with an inspector, a **Test** panel of one-click buttons, a console reader, and screenshot gallery. Ask the AI to *audit the screen* — it reads the real layout, fixes the code, restarts the preview and re-checks with assertions.
9. **Glass surface.** Settings -> Appearance -> Glass surface. Solid (classic), Liquid Glass (refracts and bends what is behind the chatbox and Dynamic Island), or Blur (frosted, no refraction).
10. **Gradients.** Settings -> Appearance -> Theme-matched gradients. Flip it (or change theme with it on) and the card meshes travel across their surface and settle into the new palette instead of snapping — the colour arrives rather than appearing. The swatch row under the switch previews it live.
11. **Humanize.** After any answer, press **Humanize** under the reply. The model rewrites its own text in human prose, shown in green, with the previous response kept in red behind the hover tooltip. Nothing else in the conversation changes, and Coding mode never shows the button.

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

**Privacy Shield.** Three postures, switchable in the shield panel: **No Privacy** scans nothing; **Privated** (default) scans every interaction and redacts API keys and other secrets from anything outbound, keeping chats private to the outside world; **Top Secret** scans everything, blocks all outbound traffic except your selected chat provider (search runs offline with clearly-labeled local results), and never persists connection history. Secret-looking tokens are redacted to `[REDACTED]` before they can leave the device in any mode that scans.

**Coding mode, Design mode & MCP.** The Coding workspace edits projects stored in `<data-dir>/projects/` and runs commands only inside the project folder with secrets stripped from the environment. Design mode starts the project's own dev server on a random local port and puts a small injecting proxy in front of it; both are killed when you stop the preview or quit the app, and nothing is uploaded anywhere — the preview is served to your browser only. Destructive commands are blocked outright; mutating ones require explicit approval. MCP servers (Settings → Coding & MCP) are spawned on demand and killed after each tool listing or call; their environment variables are used but never logged.

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
| `Cmd/Ctrl + Shift + F` | Full screen in the IDE (chat becomes a floating pill) |
| `Esc` | Close the topmost overlay |

---

## Development

```text
researchengine/
├── frontend/        # React 18 + Vite + Framer Motion + Tailwind-style CSS vars
│   ├── src/components/ide/  # Coding workbench + Design studio
│   ├── src/lib/flow/        # AIFlowEngine: classifier, pruner, cache, engine
│   ├── src/lib/ide/         # design bridge client, preview API, UI test runner
│   ├── src/lib/providers/   # OpenAI-compatible / Anthropic / Ollama streaming
│   └── scripts/             # smoke.mts, design-test.mts, ui-test.mts, render-check.mts, …
├── backend/         # Hono + SQLite (better-sqlite3 with in-memory fallback)
│   └── src/preview/         # dev-server detection, injecting proxy, design bridge
├── desktop/         # Tauri 2 shell (Rust) + packaging config
├── scripts/         # package-binary.mjs, dev.mjs
├── Dockerfile.single
└── compose.slim.yml
```

Daily loop:

```bash
npm run dev                     # hot reload, both servers
npm run smoke                   # functional smoke suite (frontend/scripts/smoke.mts)
npx tsx scripts/ui-test.mts     # IDE chrome render check (workbench + design studio)
npx tsx scripts/render-check.mts # tabs, project names, humanize (green/red + tooltip)
npx tsx scripts/design-test.mts # design-bridge end-to-end (preview + jsdom, needs a running backend)
npx tsx scripts/sample-test.mts # sample app: create → preview → audit → AI-side fix
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

**7. Windows: "500 Cannot read properties of null (reading 'name')" when creating a project.** Fixed in 0.21.1. Every project path was validated with a POSIX `/` separator, which never matches a Windows path — so on Windows the IDE considered every project folder invalid. Update to 0.21.1 and project creation, the sample app, the file tree and the preview all work. `./research-engine version` tells you which build you have.

**8. Something is broken and the toast is gone.** Settings → **Developer** → *Test: create a project* / *Test: create the sample app* runs the real create path, prints the request, the HTTP status, the response body and the duration, then deletes what it made. **Copy report** puts all of it on the clipboard. Developer Mode also adds a build fingerprint to the top bar so you can tell at a glance whether the bundle in front of you is the one you just built.

**9. "That name has no usable characters left" when creating a project or the sample.** Fixed in 0.20 — creation can no longer be refused for a name. An empty or unusable name is named for you (`untitled-project`), a taken name becomes `name-2`, and the sample button retries with a free name before it ever shows an error. If you still see this message, you are running an older build: check with `./research-engine version` (below).

**10. A fix is in the code but the app still shows the old behaviour.** You are almost certainly running an older build. Ask the launcher first:

```bash
./research-engine version      # prints the version being served and whether it matches this code
```

Then open **Settings -> About**: it prints the version and build stamp of the bundle in your browser, and if the server on disk is serving a different one it says so with the command to run. For a source checkout that is:

```bash
git pull && npm install && npm run build   # then restart the server
```

If the banner does not appear but the page still looks stale, press **Clear cache & reload** on that same About screen — it unregisters the PWA service worker and drops the cached app shell (a hard reload, `Cmd/Ctrl + Shift + R`, does the same).

**11. Onboarding loops.** Onboarding state lives in local storage for browser installs and in the database for hosted ones; clearing site data mid-onboarding restarts it. Complete it once and it never re-appears.

**12. Memory grows during long sessions.** Switch to the `eco` profile, disable High-memory mode, and keep AIFlowEngine on Efficient — context capsules keep prompt size bounded, and history hydrates on demand.

**13. Docker container restarts immediately.** Check `docker logs research-engine`; the usual cause is a volume permission mismatch — the image runs as a non-root user and needs write access to `/data`.

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

MIT License — Copyright (c) 2026 dnishh. See [LICENSE](LICENSE). Use it, fork it, ship it inside your own product, sell it; the only requirement is that the copyright notice and permission notice travel with the copy.

Made by **dnishh**, in the open, with no company behind it.

Interface components come from [ReactBits](https://reactbits.dev), [HeroUI](https://www.heroui.com), [Aceternity UI](https://ui.aceternity.com), [Border Beam](https://beam.jakubantalik.com) and [Orbs](https://orbs.jakubantalik.com) by Jakub Antalik, and [Blobatar](https://blobatar.dev) by Alain — all credited inside the app under Settings → About.

Built on the shoulders of excellent open source: React, Vite, Hono, Zustand, Framer Motion, esbuild, KaTeX, pdf.js, Mammoth, Lucide, better-sqlite3, and Tauri. Their licenses travel with their packages.
