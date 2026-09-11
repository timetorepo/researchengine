# Research Engine

A self-hosted, privacy-first research platform with Perplexity-level answer quality.
All user data stays local; only outbound API calls to **user-configured** providers ever leave the device.
Built for researchers, scientists, students, and privacy-conscious power users.

> No telemetry. No analytics. No update pings. No Research Engine cloud — there are no Research Engine servers.

---

## Quick start

### Docker (one command)

```bash
docker compose up --build
# → app on http://localhost:8080
```

Two containers: **frontend** (Nginx static SPA) and **backend** (Node + Hono + SQLite).
Uncomment the `searxng` service in `docker-compose.yml` for the full self-hosted search stack.

### Development

```bash
cd frontend && npm install && npm run dev    # → http://localhost:5173
cd backend  && npm install && npm run dev    # → http://localhost:8787 (optional)
```

The frontend is fully functional without the backend — a clearly-labeled **local demo model**
answers until you add your own API keys.

---

## The product

| Feature | What it does |
|---|---|
| **BYOK Providers** | OpenAI, Anthropic, Groq, Ollama (auto-detected via `/api/tags`), NVIDIA NIM, and any OpenAI-compatible endpoint (Together, Mistral, LM Studio, LocalAI, text-generation-webui). Keys are AES-GCM encrypted with a PBKDF2-derived key from your passphrase. Test-connection shows real latency or the real provider error. |
| **AIFlowEngine** | Prompt-optimization layer: on-device query classification, context pruning into capsules, dynamic prompt shaping, response-length calibration, skill injection, and a semantic cache. Cuts token usage 40–70%. Modes: Efficient / Balanced / Fidelity. Every response has a transparency panel: original vs. pruned context, tokens sent/received, estimated cost saved. |
| **SkillBuilder** | Turn any prompt into a reusable, parameterized skill. Auto-parameterize, typed input schema, output format, model binding, category. Callable anywhere via `/`, chainable, export/import as JSON. Seven built-in starter skills. |
| **Agent Flood** | Deploy parallel specialized agents (Researcher, Builder, Critic, Synthesizer, Verifier, …) on one objective. Preset squads (Deep Research, Software Design, Study Team) plus a custom builder. Live status cards, color-coded threaded scratchpad, budget caps, attributed synthesis. |
| **Web Search** | SearXNG default (self-hosted), with Brave / Serper / Tavily / DuckDuckGo adapters. Numbered citation badges, gradient source strip, bidirectional hover highlight. |
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

## Keyboard

`⌘/Ctrl K` palette · `⌘B` sidebar · `⌘N` new chat · `⇧⌘N` new chat w/ search · `⌘M` math mode ·
`⌘F` Flow · `⇧⌘A` Agent Flood · `⇧⌘S` settings · `⌘/` shortcuts · `/` skills · `@` sources ·
`↑` edit last · `⌘Enter` send with search.

---

## Architecture

```
research-engine/
  docker-compose.yml
  frontend/           React 18 + TS (strict) + Vite/SWC + Tailwind 4 + Framer Motion + Zustand
    src/
      components/     chat, sidebar, input, quiz, article, agents, skills, settings, os, easter, compare, shared
      hooks/          global shortcuts, list virtualization
      stores/         zustand (persisted data + ephemeral UI)
      lib/
        providers/    openai-compatible / anthropic / ollama streaming adapters + demo engine
        search/       backend selection
        flow/         AIFlowEngine — classifier, pruner, cache
        crypto/       AES-GCM vault (Web Crypto, PBKDF2)
        quiz/         heuristic question generation
        documents/    PDF.js / Mammoth extraction
      themes/         token sets applied via CSS custom properties
  backend/            Hono on Node
    src/
      routes/         health, search, chat (SSE passthrough), documents, ollama, integrations
      services/       search adapters, flow helpers, agent orchestrator
      db/             Drizzle schema over better-sqlite3 (in-memory fallback)
```

### Privacy guarantees

- API keys never reach the backend except when you route a request through it — and then only in memory, never logged.
- The backend logger records method + path only. Never bodies, never keys.
- Every outbound request appears in the Connection Log, exportable as CSV.
- All state lives in the browser (or your SQLite volume in Docker). Export / import / wipe from Settings → Data.

## Performance

- `content-visibility: auto` on message rows; virtualized lists over 30 items
- Only `transform`/`opacity` animated; spring physics (damping 25, stiffness 300)
- Heavy modules (PDF.js, Mammoth, KaTeX fonts) load as lazy chunks
- Streaming renders per-chunk with memoized markdown subtrees; the signature text-reveal settles each block with an 80ms opacity/blur/translate
- Debounced inputs, throttled scroll, rAF-island token updates

## License

MIT.
