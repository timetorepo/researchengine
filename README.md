# Research Engine

**Pre-release: `v0.13.0-beta.1` — lightweight runtimes**

> Everything from v0.11 still works — plus: versioned Master Prompts you can inspect and override; a New Tech (Replication) mode that executes a visible, staged research plan; a rebuilt Read & Quiz studio with a 720px study reader, AI rewrite and premium quizzes (6 question types, confetti, streaks, timer ring); AI-fetched article images from Wikimedia Commons; a Perplexity-inspired theme; ZIP export and merge-import; and a global command palette.

A self-hosted, privacy-first research platform with Perplexity-level answer quality.
All user data stays local; only outbound API calls to **user-configured** providers ever leave the device.
Built for researchers, scientists, students, and privacy-conscious power users.

> No telemetry. No analytics. No update pings. No Research Engine cloud — there are no Research Engine servers.

---

## Quick start

> **Research Engine does not require Docker.** Docker is optional and usually
> the heaviest way to run it. Most people should use the single-process server,
> the native binary, or the desktop app.

### Recommended run modes (light → heavy)

| Mode | What it is | Best for |
|---|---|---|
| **Single-process server** | One Node process serves API + built frontend + SQLite | Daily driver on any machine |
| **Native / portable binary** | Packaged launcher + bundle, no Docker | Simple installs, servers without containers |
| **Desktop app (Tauri)** | OS webview shell + local backend | Best "feels native" laptop experience |
| **Node/Bun direct** | `npm run dev` / `npm start` from source | Contributors |
| **PWA** | Install from the browser; BYOK providers + local storage | Ultra-light, no install |
| **Docker (optional)** | Single slim image, or the legacy compose stack | Servers / NAS / isolation fans |

### 1. Single-process server (default)

```bash
npm install                       # root workspaces: frontend + backend
npm run build                     # builds frontend (Vite) and backend (esbuild)
npm start                         # → http://127.0.0.1:3847
```

One process serves the API, SSE streams and the built frontend. If port 3847
is busy the next free port is picked and remembered. Options:

```bash
node backend/bin/research-engine.mjs serve --port 3847 --profile eco --data-dir ~/.research-engine
```

### 2. Portable / native binary

```bash
npm run package:binary            # → release/research-engine-<os>-<arch>/
npm run package:binary -- --bun   # single self-contained executable (needs Bun)
```

### 3. Desktop app (Tauri 2)

```bash
cd desktop && npm install && npm run tauri:dev     # develop
npm run tauri:build                                # .app / .exe / .AppImage
```

See `desktop/README.md` — tiny RAM overhead vs Electron, uses the OS webview.

### 4. Development loop

```bash
npm run dev     # Vite HMR on :5173 + backend API on :8787 (Vite proxies /api)
```

### 5. PWA

The build ships a web manifest and an app-shell service worker (static assets
only — API traffic is never cached), so any deployment can be installed from
the browser: *Add to Dock / Add to Home Screen*. Works fully client-side with
BYOK cloud providers; the local backend adds live search and document pipelines.

### 6. Docker (optional)

```bash
docker compose -f compose.slim.yml up --build     # one slim image, :3847, 512M cap
docker compose up --build                         # legacy two-container stack, :8080
```

---

### Data directory (same layout everywhere)

```
~/.research-engine/        override with RESEARCH_ENGINE_DATA_DIR
  db.sqlite                SQLite (in-memory fallback where native modules can't build)
  media/  notebooks/  cache/
  config.json              remembered port + profile
  keys.enc                 reserved for encrypted key material
```

### Startup profiles

| Profile | Effect |
|---|---|
| `eco` | 1 flood worker · 1 concurrent stream · top-5 search · no background work |
| `balanced` (default) | 2 workers · 2 streams · top-7 search · background indexing |
| `performance` | 4 workers · 4 streams · top-9 search · larger caches |

```bash
npm run start:eco                              # or --profile performance
```

In-app: **Settings → Performance** — profile picker, a high-memory-mode toggle
(off by default), and a live resource panel (process RAM, SQLite size, data-dir
and cache size, uptime) sampled from the single-process server.

### First run

1. Start any mode above
2. Onboarding: Welcome → Privacy → Provider (skippable) → Try the demo → You're set
3. On machines reporting ≤ 8 GB RAM, Eco mode is offered on by default
4. Privacy shield stays green — nothing leaves the device except calls you aim

Run the functional smoke test (52 checks: chat pipeline, AIFlowEngine, crypto
vault, master prompts, replication planner, all six quiz types, demo document,
image fetching, parallel agents, live-search fallback, store):

```bash
npm run smoke --workspace frontend
```

The frontend is fully functional without the backend — a clearly-labeled **local demo model**
answers until you add your own API keys.

---

## The product

| Feature | What it does |
|---|---|
| **Onboarding** | First-launch guided setup: theme → background → AIFlowEngine mode → optional provider key (with encrypted vault + connection test). Re-runnable from Settings → About. |
| **Custom backgrounds** | Solid color, image, blurred image, or dark veil — rendered behind all chrome, stored locally (images are downscaled on-device). |
| **BYOK Providers** | OpenAI, Anthropic, Groq, Ollama (auto-detected via `/api/tags`), NVIDIA NIM, and any OpenAI-compatible endpoint (Together, Mistral, LM Studio, LocalAI, text-generation-webui). Keys are AES-GCM encrypted with a PBKDF2-derived key from your passphrase. Test-connection shows real latency or the real provider error. |
| **AIFlowEngine** | Prompt-optimization layer: on-device query classification, context pruning into capsules, dynamic prompt shaping, response-length calibration, skill injection, and a semantic cache. Cuts token usage 40–70%. Modes: Efficient / Balanced / Fidelity. Every response has a transparency panel: original vs. pruned context, tokens sent/received, estimated cost saved. |
| **SkillBuilder** | Turn any prompt into a reusable, parameterized skill. Auto-parameterize, typed input schema, output format, model binding, category. Callable anywhere via `/`, chainable, export/import as JSON. Seven built-in starter skills. |
| **Agent Flood** | Deploy parallel specialized agents (Researcher, Builder, Critic, Synthesizer, Verifier, …) on one objective — each agent is a real model run (3 concurrent) with live token counters, budget-cap aborts, color-coded threaded scratchpad, and a real synthesis pass that merges the actual contributions. Preset squads (Deep Research, Software Design, Study Team) plus a custom builder. |
| **Web Search** | Real engines: SearXNG (self-hosted default), Brave / Serper / Tavily / keyless DuckDuckGo via the backend with automatic fallback, plus in-browser Wikipedia when the backend is offline. Answers are grounded in the retrieved results with numbered `[n]` citations. |
| **Read & Quiz** | Drop PDF / DOCX / TXT / Markdown. Extracted locally (PDF.js worker, Mammoth). Quizzes with 4 question types, difficulty, per-question timers, topic-level accuracy, Review-Mistakes flow. |
| **Articles** | Convert any chat into a block-based article. AI rewrite/expand/condense per block. Reader with serif typography, auto TOC, reading time. Export Markdown. |
| **Compare Mode** | One prompt → up to 3 models side by side, synchronized scrolling, pick a winner or merge. |
| **Library** | Auto-saved citations (APA, MLA, Chicago, IEEE, BibTeX export), knowledge cards with confidence, spaces. |
| **Research Threads** | Branch any response into a new conversation. |
| **Integrations** | Google Drive/Mail/Calendar, GitHub, Notion, Zotero, local files. Read-only by default; OAuth via a localhost callback; tokens encrypted locally; visible connection log. |
| **Privacy Shield** | Always visible. Green when everything is local, amber when integrations are active. Opens a panel listing exactly what goes where, plus the live outbound connection log. |
| **Focus Timer** | Floating Pomodoro pill; pairs with quiz study sessions. |

### Easter eggs

None are announced. `-404`, `/konami`, `origin story`, long-press the logo, tap the Privacy Shield seven times.
A hidden `/secrets` route documents them — the shortcuts panel contains the only hint. All stand down under `prefers-reduced-motion`.

---

## Themes

Default Dark (signature), Default Light, Catppuccin Latte / Frappé / Macchiato / Mocha, Nord,
Solarized Light & Dark, High Contrast, and **ResearchEngineOS** — a desktop-OS-like environment with a
translucent titlebar, glass dock, and a morphing Dynamic Island (idle model, live streaming token count
with waveform, search scanner, agent dots, focus ring, skill spinner; long-press expands into a status panel).

Every theme ships a full token set, adjusted gradients, and a matching code theme.

## Component system

Bundled under `src/components/ui/`:

- **`heroui/`** — HeroUI-style primitives: `Button` (variants/colors/sizes/loading), `Input`, `Switch`.
- **`aceternity/`** — `SpotlightCard` (cursor-tracked radial light), `TextGenerateEffect` (word-by-word blur reveal), `AuroraBackground`, `MovingBorder` (sweeping conic border).
- **`reactbits/`** — `AnimatedCounter` (eased count-up), `Magnetic` (cursor-lean spring).

Used across Home, Onboarding, Settings, TopBar, and the Agent Flood deploy action.

## Keyboard

`⌘/Ctrl K` palette · `⌘B` sidebar · `⌘N` new chat · `⇧⌘N` new chat w/ search · `⌘M` math mode ·
`⌘F` Flow · `⇧⌘A` Agent Flood · `⇧⌘S` settings · `⌘/` shortcuts · `/` skills · `@` sources ·
`↑` edit last · `⌘Enter` send with search.

---

## Architecture

```
research-engine/
  docker-compose.yml      legacy two-container stack (optional)
  compose.slim.yml        single slim image + resource limits (optional)
  Dockerfile.single       one image: API + built frontend + SQLite
  desktop/                Tauri 2 shell (OS webview, no Electron)
  scripts/                dev runner + native packaging
  frontend/               React 18 + TS (strict) + Vite/SWC + Tailwind 4 + Framer Motion + Zustand
    src/
      components/         chat, sidebar, input, quiz, article, agents, skills, settings, os, easter, compare, reader, shared
      hooks/              global shortcuts, list virtualization
      stores/             zustand (persisted data + ephemeral UI)
      lib/
        prompts/          versioned Master Prompts (the normative system texts)
        providers/        openai-compatible / anthropic / ollama streaming adapters + demo engine
        search/           backend selection ladder (backend → Wikipedia → offline)
        flow/             AIFlowEngine — classifier, pruner, cache
        system/           performance profiles + live resource sampling
        crypto/           AES-GCM vault (Web Crypto, PBKDF2)
        quiz/             heuristic question generation (6 types) + confetti
        documents/        PDF.js / Mammoth extraction + bundled DNA demo
    public/               PWA manifest + app-shell service worker
  backend/                Hono on Node — single-process server
    bin/research-engine.mjs   CLI launcher (serve --port --profile --data-dir)
    src/
      runtime.ts          data dir, config.json, profiles, port auto-pick
      static.ts           built-frontend serving with SPA fallback
      routes/             health, resources/config, search, chat (SSE), documents, ollama, integrations
      db/                 Drizzle schema over better-sqlite3 (in-memory fallback)
```

### Privacy guarantees

- API keys never reach the backend except when you route a request through it — and then only in memory, never logged.
- The backend logger records method + path only. Never bodies, never keys.
- Every outbound request appears in the Connection Log, exportable as CSV.
- All state lives in the browser (or in `~/.research-engine` when the single-process server runs). Export / import / wipe from Settings → Data.

## Performance

- `content-visibility: auto` on message rows; virtualized lists over 30 items
- Only `transform`/`opacity` animated; spring physics (damping 25, stiffness 300)
- Heavy modules (PDF.js, Mammoth, KaTeX fonts) load as lazy chunks
- Streaming renders per-chunk with memoized markdown subtrees; the signature text-reveal settles each block with an 80ms opacity/blur/translate
- Debounced inputs, throttled scroll, rAF-island token updates

## License

MIT.
