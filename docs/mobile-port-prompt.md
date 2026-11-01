# Research Engine on mobile — the port prompt

A self-contained brief for whoever builds the mobile version of Research Engine
(agent or human). It is written to be executed, not admired: every requirement
has a number, a place to put it, and a way to prove it.

Written 2026-10-03 against Research Engine **0.36.0-beta.1**, repository
`timetorepo/researchengine` (private, MIT), branch `arena/01a0b91b-researchengine`.

---

## 0. How to use this document

There are two prompts in here.

**The kickoff prompt** — paste this into a fresh session, with this file attached:

> Read `research-engine-mobile-port-prompt.md` end to end, then read the actual
> repository: `backend/src` (the Hono server), `frontend/src` (the React app),
> `desktop/src-tauri` (the Tauri 2 shell), `docs/`, and `README.md`. Do not write
> code yet. Produce two things first: (1) the feature parity matrix from Part 4,
> filled in with the real file paths and route names you found, and any row where
> you disagree with my placement plus your reason; (2) the design documentation
> skeleton from Part 8, with the real token values read out of
> `frontend/src/lib/themes/meta.ts` and `frontend/src/styles/globals.css`. Then
> start R1 from Part 13.

**This document** — the spec that kickoff refers to. Everything below is binding
unless the person running it says otherwise. Where a number appears, it is a gate,
not a suggestion.

---

## 1. The mission, as acceptance criteria

The request, restated so it can be checked:

1. **Research Engine runs on a phone**, with every feature it has today reachable
   from the phone.
2. **The features run locally on the device** wherever that is technically
   possible. Local-first is the product's whole argument; a mobile version that
   is a thin client for a cloud service would contradict everything the desktop
   app says about itself.
3. **Where a feature is genuinely too heavy for a phone, the user's computer is
   the backend.** Not someone's server — *their* computer, the one already running
   Research Engine, reached over their own network by default.
4. **Insane optimization, without the features being limited.** This is not a
   request for a "lite mode". No feature may be removed, hidden, or made
   read-only in the name of performance. Optimization means *where the work
   happens* and *how efficiently it is drawn*, never *what the app can do*.
5. **120 fps stable on a 120 Hz device, or 60 fps stable on a 60 Hz device.**
   Stable means p95 frame time inside the budget and p99 not exceeding it by
   more than 20%, measured while scrolling, streaming, and animating at once.
6. **Mobile-first UI, pixel-accurate.** Designed for a thumb, not a shrunken
   desktop window. The design documentation is a deliverable of equal weight to
   the code.
7. **Design documentation for phone**, complete enough that another designer can
   build a screen that matches without asking a question.
8. **References from Awwwards, Dribbble and Refero**, used deliberately (Part 9).
9. **Almost no latency: respond in either 10 ms or 200 ms.** Two tiers, defined
   precisely in Part 6, both measured.

If a requirement conflicts with a platform rule (App Store review, Android
background limits), the requirement wins on *capability* and the platform rule
wins on *mechanism* — and the difference is written down where the user can see
it, not hidden.

---

## 2. What exists today (verified, so the port does not guess)

**The backend** — a Hono HTTP server on Node (`backend/src/index.ts`, ~20 route
modules mounted under `/api`). Bundled by esbuild to a single file; packaged as a
sidecar binary for the desktop app (`backend/bin/research-engine.mjs`). Port 3847
in a packaged build, 8787 in dev, with a remembered-port fallback. Notable routes:
`chat`, `search`, `library`, `documents`, `voice`, `integrations`, `connectors`,
`mcp`, `providers`, `ollama`, `ide`, `preview`, `fs`, `resources`, `secrets`,
`skills`, `update`, `feedback`, `health`.

**Storage** — SQLite inside the user's library folder (`db.sqlite`), Drizzle ORM,
`better-sqlite3` as an optional dependency. The whole library is one folder that
can be copied, which is the product's promise about data ownership.

**The frontend** — React 18 + Vite 6 + Tailwind 4, Zustand stores, `motion` for
animation, 183 component files, 12 themes (`frontend/src/lib/themes/meta.ts`:
dark, light, four Catppuccin, nord, solarized ×2, high-contrast, re-os,
perplexity), shadcn-style tokens, Geist Sans and Geist Mono. There is already a
`manifest.webmanifest` and a service worker in `frontend/public/`, so a PWA shell
is partly there. Heavy dependencies that exist for desktop visuals: `three`,
`@react-three/fiber`, `postprocessing`, `ogl`, `pdfjs-dist`, `katex`, `mammoth`,
`jszip`, `sonner`, `@heroui/modal` + `@heroui/tabs`, `@number-flow/react`,
`border-beam`, `thinking-orbs`, `voice-glow`.

**The providers** — 17 entries in `frontend/src/lib/providers/registry.ts`:
fourteen hosted services (OpenAI, Anthropic, Google Gemini, Groq, Mistral, xAI,
DeepSeek, Kimi, GLM, MiniMax, NVIDIA, OpenRouter, Together, Mercury), plus
**Ollama**, **LM Studio** and a **custom** slot. There is also a **local demo
answer engine** (`frontend/src/lib/providers/demo.ts`) that runs entirely on the
device and is honest about being a demo — it is what makes the first run work
with no key at all, and mobile keeps it.

**The desktop shell** — Tauri 2 (`desktop/src-tauri`), product name
"Research Engine", identifier `dev.researchengine.desktop`, the server shipped as
an `externalBin` sidecar, the built frontend as a bundled resource, NSIS Windows
installer + Linux deb/AppImage built in CI (`.github/workflows/desktop.yml`).

**The performance machinery already in the app** — `frontend/src/lib/system/frame-budget.ts`
samples real frame times, keeps a median, and drops visual quality by level with
documented thresholds: **16.7 ms** is one 60 Hz frame, **22 ms** means "holding
with no headroom", **past 34 ms** the expensive layers go. `PerformanceTab.tsx`
exposes it. There is no equivalent for 120 Hz, thermal state, or battery yet.

**The latency machinery already in the app** — `backend/src/routes/library.ts`
carries the app's own budget: `const BUDGET_MS = 200`, per-lane results, and a
`why()` that reports *why* a lane failed. This is the origin of the 200 ms number
in the request; the mobile port should treat it as a contract that already
exists, not as a new idea.

**The limits of what mobile can copy from desktop:**

| Desktop mechanism | Why it does not transfer |
|---|---|
| Node sidecar process | iOS has no such thing; Android only with a bundled runtime, and then battery and review risk follow |
| WebGL backgrounds (`three`, `ogl`, `postprocessing`) | Expensive on mobile GPUs; a blurred 60 fps shader costs more than the entire rest of the UI |
| `backdrop-filter` on many surfaces | Compositing blur per frame on mobile is one of the fastest ways to lose 120 fps |
| Hover-driven affordances, right-click menus, `Ctrl+K` | No pointer, no hover, no keyboard by default |
| Coding workspace and design mode | Need a real filesystem, a terminal, a window to inspect, and a screen bigger than 6 inches |

---

## 3. The one architectural decision

**Build the mobile app as Tauri 2 mobile: the existing React UI inside the system
WebView (WKWebView on iOS, Android WebView on Android), with a Rust core that
takes over everything the Node sidecar does today.**

Why this and not the alternatives:

| Option | Verdict |
|---|---|
| **Tauri 2 mobile + Rust core** (chosen) | Reuses the whole React app and the whole design system, reuses the Tauri 2 knowledge already in `desktop/`, gives real native capability (SQLite, filesystem, Metal/NNAPI compute, background tasks, secure storage) through Rust, and ships one codebase to both stores. |
| React Native / Expo rewrite | Second UI codebase, second design system, and 183 component files get rewritten before anything ships. Rejected for cost, not for quality. |
| Node sidecar on device (nodejs-mobile) | A JS runtime plus a second process on a phone, for a server that is mostly doing work Rust does better. Battery, memory and App Store risk. Rejected. |
| Pure PWA | Free to ship, but cannot touch the filesystem, cannot run on-device models reliably, cannot do background jobs, and cannot hold 120 fps with the app's visual density. Keep the PWA as the *desktop browser* story, not as the mobile product. |
| Native SwiftUI + Compose | The best possible ceiling for feel. Wrong starting point: it forks the design system and doubles the work before parity exists. Kept as a *documented escape hatch* (below). |

**The escape hatch, stated in advance.** If a specific screen cannot hold its
frame budget inside a WebView after the techniques in Part 5 have been applied,
that screen — and only that screen — may be built as a native island
(SwiftUI on iOS, Compose on Android) that renders from the same token file. The
screens that would qualify, in order of likelihood: the reader with thousands of
highlights, the article editor with long documents, the workflow canvas. The rule:
**the decision is made from a measurement, written into
`docs/mobile/native-islands.md`, with the numbers that forced it** — never
because native "feels better".

**Repository shape for the port** (a new top-level folder; the existing packages
are not restructured):

```
mobile/                     # the Tauri 2 mobile app (iOS + Android)
  src/                      # the mobile UI: layout, screens, components
  src-tauri/                # the Rust core (see below)
  native/                   # native islands, if any, and platform glue
crates/
  re-core/                  # library, DB, search, indexing, jobs — shared logic
  re-models/                # on-device inference: llama.cpp/MLX bindings, embeddings
  re-net/                   # companion protocol, pairing, transport, pins
  re-fs/                    # document import, PDF text+geometry, OCR, files
packages/
  tokens/                   # single source of truth: tokens.json + generators
  prompts/                  # master prompts + skills, shared verbatim with desktop
  types/                    # IPC DTOs shared by mobile, desktop and backend
docs/mobile/                # the design documentation (Part 8)
```

The desktop gains exactly one new module: the **companion server** (Part 4.3),
which is a new set of routes on the existing Hono server plus a pairing UI. The
desktop UI does not get redesigned in this port.

### 3.1 What the Rust core owns

- **Library**: SQLite (via `rusqlite` or `sqlx`) with the same schema semantics as
  `backend/src/db`; migrations shared as SQL so both sides stay compatible.
- **Search**: the local index over the user's own documents, plus the lane model
  the app already has (documents → Wikipedia → trusted sources), with the same
  `why()` reporting on failure.
- **Documents**: PDF text and geometry extraction (a Rust crate, not `pdfjs-dist`
  in the WebView for the heavy path), DOCX, Markdown, plain text; OCR on demand;
  page-at-a-time streaming into the reader.
- **Models**: embeddings for library search; a local generative model for offline
  answers; downloads and integrity checks; a model manager with size classes.
- **Jobs**: a single job queue for anything long — indexing, flood runs, exports,
  transcription — with pause/resume, so background limits degrade a job instead
  of killing it.
- **Networking**: provider calls with prewarmed connections, streaming, retries,
  and the per-provider timeout the app already exposes.
- **Security**: keys in Keychain/Keystore (StrongBox where available), at-rest
  encryption of the library, the Privacy Shield postures enforced *here* so they
  cannot be bypassed by a UI bug.

---

## 4. Where each feature runs

This is the heart of the port. Three placements:

- **Device** — runs fully on the phone, offline, no computer involved.
- **Companion** — needs a computer; the phone is the client, the desktop is the
  worker. Must degrade honestly when unpaired.
- **Hybrid** — works on the device, and gets better/faster when a companion is
  present.

### 4.1 Parity matrix

Everything in `README.md`'s feature list, placed:

| Feature (as the app names it) | Placement | Why, and what the phone actually does |
|---|---|---|
| Answers with numbered citations | **Device** | Chats, streaming and citations are the core loop. Answer rendering, source list, "open the page beside it". |
| Streaming with the pacing engine | **Device** | Clause-by-clause pacing is a rendering concern. Reimplement against the frame budget: pacing must never cost frames (Part 5.4). |
| Five answer modes (Flow, Search, Quality, Math, Replicate) | **Device** | Prompt-level features. Identical prompts, shared from `packages/prompts`. |
| 17 provider entries: 14 hosted, plus Ollama, LM Studio and custom | **Hybrid** | Direct from the phone with keys in the Keychain. With a companion paired, the phone may route through it to save battery, keep keys off the phone, or reach a desktop-only local model. |
| The local demo answer engine (`demo.ts`) | **Device** | Already runs entirely on device and says so in its own copy. It stays on mobile, unchanged in spirit: a first run that works before any key exists, and never pretends to be a real model. |
| Free routing | **Device** | Same logic, same rules. |
| Token cost per answer | **Device** | Counted where the stream is parsed. |
| Attachments (images, PDFs, docs, files) | **Device** | Filesystem + photo picker, camera, Files app. No upload to anyone. |
| Search that works on install | **Hybrid** | Public adapters direct from the phone. A paired companion exposes its SearXNG instance first, which is faster and private. |
| Search across your own documents | **Device** | Local index in SQLite; this is where the 10 ms tier lives. |
| Read & Quiz: reader, highlights, summary | **Device** | The reader is the most important device-side screen. Text, highlights and quiz generation that needs a model use the on-device model or a provider. |
| Six question types, timer, streaks, result card | **Device** | Pure logic + one render pass. Haptics on correct/incorrect. |
| Instant sentence marking | **Device** | Local, must be ≤10 ms to the first pixel of the sweep. |
| `:dot:` / step formatting at display time | **Device** | Cheap transform, already zero-cost by design. |
| Study timer in the top bar | **Device** | Becomes a live activity (iOS) / persistent notification (Android) when the app is backgrounded. |
| Articles editor with Wikimedia images | **Device** | Editor is fine on device. Very long articles are the first candidate for a native island. |
| Notebooks, chat against a notebook | **Device** | Local index scoped to the notebook. |
| Share Studio (answer/result cards) | **Device** | Render to an image locally; native share sheet. |
| Humanize | **Device** | Same prompt; runs on the on-device model or a provider. Keep the green/red diff interaction. |
| Export/import the whole library as ZIP | **Hybrid** | Small libraries on device. Large libraries: hand the job to the companion, which already streams and can resume. |
| Agent Flood | **Companion-preferred, Device-capable** | A squad of parallel agents is many simultaneous calls, a big context, and a long runtime. On device: a reduced squad size (2–3 agents) with a hard token budget and a foreground-service/background-task window. With a companion: full squads, phone watches progress live. The *feature* is never removed; the *scale* adapts, and the UI says which scale you are getting. |
| Workflows | **Hybrid** | Monitoring, running, approving and reading history on the phone. Building a canvas of 20 nodes is a tablet/desktop job, and the phone says so with a "open this on your computer" affordance — it does not show a broken canvas. |
| Coding workspace | **Companion** | Needs a real filesystem, a terminal and a project. Phone role: read diffs, approve actions, watch runs, answer review questions. Unpaired: the section explains what it is and offers pairing. |
| Design mode | **Companion** | It inspects a running desktop app's geometry, colours and console. Phone role: watch, approve, and *prove* — including driving the desktop preview at phone widths, which is a nice symmetry. |
| "Try a sample app" | **Companion** | Runs a project on the computer. |
| Integrations (Drive, Gmail, Calendar, GitHub, Notion, Slack, local files) | **Hybrid** | OAuth/device flows on the phone for the ones that allow it; token storage in the Keychain; sync and heavy fetch can be delegated to the companion. "You have not connected this yet" stays an answer. |
| Dictation, three engines | **Device** | Platform STT for the fast path, the on-device Whisper model for confidential work, a remote service if the user wants it. Hold-to-talk with the existing glow, plus haptics. |
| Skills and master prompts | **Device** | Same text, shared from `packages/prompts`. Readable, versioned, rollback. |
| Tasks checklist | **Device** | Local, pinned to the top of the chat. |
| Themes (12) and glass/frosted/solid surfaces | **Device** | All 12 ship on mobile. Glass becomes *shader-free* glass: layered translucency and a static noise texture, never a per-frame blur (Part 5.5). |
| Privacy Shield (three postures) | **Device** | Enforced in the Rust core, not in the UI. |
| Command palette, right-click menus, toasts, scroll indicator | **Device, redesigned** | Long-press replaces right-click; a search-first command sheet replaces `Ctrl+K`; toasts become haptic-backed snackbars. The *capabilities* stay, the *gestures* are mobile's. |
| Self-updater with rollback | **Replaced by stores** | Mobile binaries update through the App Store / Play Store. In-app: "what's new" from the same release notes, and a deep link to the store. The desktop keeps its updater. On Android, optionally ship the APK path for people who sideload, using the same fingerprint-before-unpack rule. |
| Notifications | **Device** | Off by default, exactly as on desktop. A finished flood, a finished export, a study timer — nothing else. |
| PWA / browser visit | **Unchanged** | The existing web build stays for desktop browsers. |

**Rule that resolves every future argument:** if a feature can run on the device
at all, it runs on the device; the companion is an accelerator and an executor for
things a phone genuinely cannot do, never a requirement for a feature that could
work offline.

### 4.2 What "on-device" means for models

The demo engine above is not a model, it is a canned first run. Real on-device
generation is new work, in two tiers, both real:

1. **OS-provided models.** Use them where they exist (Apple Intelligence's on-device
   model, Android's AICore/Gemini Nano). Free, no download, no battery cost of a
   second runtime. Feature-detect, never require.
2. **Bundled/downloaded models.** llama.cpp or MLX GGUF, quantized, with three
   size classes the user chooses between in plain language (not parameter counts):
   - **Quick** (~1–2 B params, Q4, ~1 GB) — summaries, rewrites, quiz generation
     for short documents, classification.
   - **Balanced** (~3–4 B, Q4, ~2–3 GB) — the default for offline answering.
   - **Deep** (~7–8 B, Q4, ~4–5 GB) — only offered on devices with the headroom,
     and only for jobs the user explicitly starts.
   Plus **one embedding model** (~30–100 MB) for library search, always installed.

Model policy:

- Downloads are resumable, verified against a published digest, paused on cellular
  by default, and deletable per model.
- On iOS, models are *data*, not executable code — keep it that way. No dynamic
  loading of executable code from the network, ever.
- Inference runs off the UI thread, on Metal (iOS) or NNAPI/GPU delegate (Android),
  with a hard memory ceiling; if a device cannot hold the model, the UI says so and
  offers the companion or a provider instead — it does not swap in a worse model
  silently.

### 4.3 The companion (the computer as backend)

**Roles.** Phone = client. Computer = worker. Relay = optional and off by default.

**Pairing.**
1. Computer shows a QR code containing `re://pair` with: host, port, the SHA-256
   of the server's public key (SPKI pin), and a single-use secret with a 3-minute
   expiry.
2. Phone scans, opens a TLS 1.3 connection to the pin, exchanges a device keypair,
   receives a device record (`device_id`, name, platform, scopes).
3. Both sides can revoke. Revoking on the computer kills the phone's keys; revoking
   on the phone deletes the pin. Pairing is visible in Settings on both sides, with
   the last connection time and the scopes granted.

**Discovery.** mDNS/Bonjour (`_research-engine._tcp`) on the local network, manual
host:port as a fallback, relay as the last resort (and only if the user turned it
on).

**Transport.** HTTP/2 over TLS; QUIC where available. Every transfer is resumable
(`Range`, the same technique the app's updater already uses). A companion
connection never blocks the UI: requests are fire-and-forget with a local job id
and a subscription for progress.

**Scopes**, granted individually at pairing time and changeable later:
`library.read`, `library.write`, `search.run`, `agents.run`, `jobs.run`,
`models.proxy`, `coding.read`, `coding.exec` (this one requires a second
confirmation within 60 seconds, for every execution).

**What the phone never sends:** the library itself, keys, or anything outside the
declared scope. A job sends an objective, not the archive. Returned artefacts
(flood briefing, export, transcript) come back over the same pinned channel and
land in the phone's library with provenance.

**Remote (not at home).** Off by default. If enabled: a self-hostable relay, an
end-to-end encrypted channel (the relay sees ciphertext and metadata only), and a
plain-language warning on the switch that turning it on means *some* metadata —
when you connected, how much, to which relay — leaves your network. No relay is
operated by the project unless the maintainer chooses to, and the client must work
with a user's own relay.

**Degradation, not dead ends.** With no companion and no network, every
companion-placed feature renders as: what it is, what it needs, and a single
primary action ("Pair your computer", "Connect a provider", "Use a smaller run on
this phone"). No spinner that never resolves, no greyed-out button with no
explanation.

### 4.4 Sync between phone and computer

- **Single source of truth remains the library folder.** Sync is a change log
  (append-only), not a merge of file trees.
- **Conflict policy by type:** chats and notes are append-only or
  last-write-wins per field; documents are content-addressed (same digest = same
  file, no duplicates); quiz results are immutable records.
- **Bandwidth:** delta sync, resumable, chunked; nothing moves unless it changed.
- **Direction:** bidirectional, with each device able to sync a subset (e.g. don't
  put the 40 GB of PDFs on the phone — sync the index and fetch files on demand,
  which is the honest answer for large libraries).
- **Encryption:** at rest on both ends; in transit inside the pinned TLS channel.

---

## 5. The performance contract

**Targets.** 120 fps stable on 120 Hz panels. 60 fps stable on 60 Hz panels.
Stable means: p95 frame time ≤ budget, p99 ≤ 1.2 × budget, zero frames over
2 × budget during the benchmark scenes, and no long tasks (> 50 ms) on the UI
thread while scrolling or streaming.

| | 120 Hz class | 60 Hz class |
|---|---|---|
| Frame budget | **8.3 ms** | **16.6 ms** |
| p95 gate | ≤ 8.3 ms | ≤ 16.6 ms |
| p99 gate | ≤ 10 ms | ≤ 20 ms |
| Dropped-frame rate in a benchmark scene | < 1% | < 1% |
| Input-to-first-pixel (Part 6 tier 1) | ≤ 8.3 ms | ≤ 10 ms |
| Cold start to interactive | ≤ 1.2 s | ≤ 1.8 s |
| Warm start | ≤ 300 ms | ≤ 400 ms |
| Resident memory, chat screen | ≤ 180 MB | ≤ 220 MB |
| Resident memory, reader with a 300-page PDF open | ≤ 350 MB | ≤ 420 MB |
| Battery, 1 h reading with the screen on | report, do not regress > 10% between releases | same |
| Thermal soak: 30 min of streaming, then re-measure | targets still met, or the quality ladder has stepped down and *said so* | same |

**Device floor.** State the supported floor in the docs and test on it, not just
on flagships: iOS — the oldest device supported by the current iOS major minus one
(e.g. iPhone SE 3 / iPhone 11 class); Android — a 2019-or-newer low-end device
with 4 GB of RAM (e.g. Pixel 4a / Redmi-class). A build that only hits its numbers
on a flagship has not met this contract.

### 5.1 The techniques that make it possible

**Rendering the answer stream.** A streaming answer is a text layout problem, and
naive React re-rendering per token is the single biggest source of jank in a chat
app.

1. Tokens accumulate into a plain, mutable buffer outside React.
2. A single animation-frame loop (shared with the pacing engine) publishes the
   visible window at most once per frame.
3. Markdown is parsed **incrementally**, only for the segment that is open, and the
   completed segments are memoized as opaque nodes.
4. The rendered list is windowed: past ~200 blocks, only what is on screen (plus a
   margin) exists in the DOM/WebView, and everything before it becomes a
   "N blocks above" capsule that can be expanded.
5. Citations and code blocks are parsed off the critical path; code gets syntax
   highlighting only for the visible viewport, at most one block per frame.

**Lists.** Every scrollable list of library items, search results, chats, quiz
questions or messages is virtualized with a fixed or measured item size, recycled
nodes, and no layout reads during scroll. No `getBoundingClientRect` in a scroll
handler, ever, anywhere.

**The quality ladder.** Extend `frontend/src/lib/system/frame-budget.ts` for
mobile with: a 120 Hz sample path, the same median-based decision, plus
**thermal state** and **low-power mode** inputs from the OS. The ladder changes
*fidelity* only:

| Level | What changes | What never changes |
|---|---|---|
| Full | Shader backgrounds, live blurs, full motion | Features, data, content |
| Lean | Static gradient background, motion simplified to opacity, blurs replaced by layered translucency | Features, data, content |
| Minimum | No background animation, no blur, instant transitions, haptics only | Features, data, content |

The ladder must be *visible*: `PerformanceTab`-equivalent shows the current level
and why ("holding 118 fps at Lean; thermal state serious"). **There is no level
that hides or disables a feature.**

### 5.2 What to delete from the mobile build (not features — costs)

- Per-frame `backdrop-filter` blur. Replace with layered translucency and one
  static noise texture. Keep blur only on the two or three surfaces that are
  visually the point (the composer, the top bar) and only at Full level.
- WebGL backgrounds (`three`, `@react-three/fiber`, `postprocessing`, `ogl`) on
  mobile. Ship static, pre-rendered gradient art at 2× and 3×, generated from the
  same theme tokens.
- Non-virtualized long text, non-virtualized lists, layout-affecting animation
  (animating `width`, `height`, `top`, `left`, `margin`), and anything that
  animates a layout property during scroll.
- Unbounded image decoding: decode at display size, cancel decodes on scroll,
  and never hold more than a screen or two of decoded bitmaps for the reader.
- Timers that run while nothing is happening. No idle polling; subscriptions are
  event-driven; background work is a job with a lifetime, not a heartbeat.

### 5.3 Animation rules (the pixel part of performance)

- Durations: **90 ms** for state toggles, **160 ms** for entering a sheet,
  **240 ms** for screen transitions, **320 ms** for the largest moves. Nothing
  longer than 400 ms except the pacing of answer text, which is content, not chrome.
- Motion is composited only: transform and opacity. Springs for gestures,
  curves for choreography (the same `[0.22, 1, 0.36, 1]` the site uses), and
  `prefers-reduced-motion` plus the OS "reduce motion" switch collapse everything
  to opacity or nothing.
- Motion must be **cancellable and interruptible**: a screen transition interrupted
  by a back gesture continues from where it is, never restarts.
- One idea per screen gets the spotlight animation. If two things animate at once,
  the second one is decoration to be cut.

### 5.4 The frame-budget governor for streaming

The pacing engine must never cost a frame. Concretely: pacing decisions happen in
the same frame callback that publishes the visible window; if publishing would
exceed the frame budget the pacing stretches (fewer characters this frame) instead
of dropping a frame. **Text that arrives slightly slower is invisible; a dropped
frame is not.**

### 5.5 Instruments and gates (what "proven" means here)

The project's culture is that a claim without a test is a bug. So:

- **Xcode Instruments** (Time Profiler, Core Animation, Allocations) on iOS and
  **Android Studio Profiler + Perfetto + Macrobenchmark** on Android, with a
  documented procedure per benchmark scene.
- **An in-app frame log**: `re-core` records frame times, level changes and thermal
  events into a ring buffer that can be exported as JSON from Settings → Advanced.
  A user reporting "it stutters" then hands over data instead of adjectives.
- **CI on real devices**: Firebase Test Lab or AWS Device Farm, running the
  benchmark scenes on the frozen device list. **The build fails on a budget
  regression**, the same way the website test fails on a copy rule.
- **Benchmark scenes**, each with a script and a budget:
  `AnswerStream` (a long streaming answer with code blocks), `Reader300` (a
  300-page PDF, scrolling, highlighting), `QuizRun` (six question types in
  sequence), `LibraryScroll` (10 000 items), `GalleryOpen` (the screenshot viewer
  opening over a live screen), `VoiceHold` (hold-to-talk with the glow running),
  `SearchBurst` (ten queries in a row against the 200 ms budget), `FloodWatch`
  (a companion flood streaming progress into a live view).

---

## 6. The latency contract: 10 ms or 200 ms

Two tiers. Every user-visible operation belongs to exactly one of them, and the
documentation says which.

### Tier 1 — 10 ms: everything the device already knows

**Definition:** from the input event to the first visible response.
**Budget:** ≤ 8.3 ms (one frame at 120 Hz); ≤ 10 ms p95 on 60 Hz devices.
**What is in it:**

- touch feedback (a control acknowledges on touch-down, not on release),
- tab and segment switches, sheet open start, theme switch,
- selection and cursor movement, text-field focus, keyboard appearance begin,
- opening the command sheet, the attachment tray, the model picker,
- **local library search results** for a query the index already holds,
- reading a chat or note from SQLite, opening a cached document page,
- marking a sentence, timer start/stop, task toggle, quiz answer selection,
- haptics.

**How it is achieved:** an in-memory index warm at launch; SQLite statements
prepared and cached; reads off the main thread with the result published in the
same frame when it is a cache hit; optimistic UI for anything that writes (the
write lands in the local store first, always); no network on any of these paths,
ever.

**How it is verified:** an automated latency harness per interaction that
dispatches synthetic input and measures input-to-paint on device. Tier-1 misses
are treated as bugs, not as tuning opportunities.

### Tier 2 — 200 ms: everything that leaves the device

**Definition:** from the action to the *first meaningful thing on screen*.
**Budget:** p50 ≤ 200 ms, p95 ≤ 350 ms — and past that, a truthful progress state
appears (what is happening, what is being waited on, and a way to cancel).
**What is in it:**

- **the search ladder** — the app's own `BUDGET_MS = 200` contract, now enforced on
  mobile too, with per-lane results and the existing `why()` reason on failure;
- **the first visible output of an answer**: the question echoed, the local hits
  already rendered, the source skeleton shown, and the stream open. *Token
  generation time is explicitly not in this budget* — you cannot promise a model's
  speed — so the contract is: something honest on screen within 200 ms, then
  tokens at a rate that never leaves a blank line (target ≥ 30 tokens/s
  perceived, achieved by the pacing engine starting as soon as the first chunk
  lands);
- **any companion round trip** on the local network (health check, library query,
  job submission acknowledgement, scope check);
- **provider connection setup** — DNS, TLS and first byte, achieved with
  prewarmed connections, HTTP/2, and keep-alive;
- **model load** for an already-warm on-device model (cold load is a separate,
  announced action with a progress bar);
- **dictation start** — the microphone opens and the level meter moves.

**How it is achieved:** connections are established when the app becomes active,
not when the user presses send; DNS is cached; every request carries a deadline
and a cancellation token; the UI never waits on a promise it cannot cancel; and
the last-known-good result for a repeat query is served instantly (stale-while-
revalidate) with a subtle "refreshing" state rather than a spinner.

**How it is verified:** the `SearchBurst` and `AnswerStream` scenes record
time-to-first-meaningful-paint per action, on device, over the real network
conditions matrix (fast Wi-Fi, LTE, congested, offline). Offline is a *tested
state*, not an exception: everything in tier 1 still works and everything in
tier 2 explains itself.

### The numbers that must never appear

- A spinner that has been on screen for more than **400 ms** without a sentence
  beside it explaining what it is waiting for.
- A progress indicator without a cancel path for anything that could take more
  than **2 seconds**.
- A blank screen during navigation. Ever. The old screen stays until the new one
  can paint.

---

## 7. Mobile-first UI: the design law

**The rule above all rules:** the phone UI is designed for a thumb and a six-inch
screen. It is not the desktop layout reflowed, and nobody is allowed to shrink a
desktop component "just for now".

### 7.1 Structure

- **Navigation: a three-destination tab bar plus one primary action.** Destinations:
  **Home** (research, recent work, the composer entry), **Library** (documents,
  notes, saved pages, search), **You** (profile, themes, settings, companion).
  The primary action is a single raised control in the middle (**Ask**), which is
  the app's whole point. Everything else is a sheet, a push, or a long-press away.
- **No hamburger drawer for primary navigation.** Ever.
- **Depth is limited to two levels of push plus one sheet.** A sheet may open a
  second sheet only for a confirmation. If a flow needs three sheets, it is a
  screen.
- **Every screen is reachable in one thumb.** Primary actions live in the bottom
  third. Nothing destructive is placed in the top-right corner on a large phone.
- **Back**: iOS edge swipe with the interactive transition; Android predictive
  back with the system animation, plus a visible back affordance where a stack
  exists. A back gesture never loses unsaved text (autosave, always).
- **Deep links and universal links** for: a chat, a document, a quiz, a flood run,
  a shared article, a companion pairing link.
- **Every screen has one job, named in the file** as a comment, and one primary
  action, styled the same way everywhere.

### 7.2 The interaction vocabulary (mobile's version of the desktop's)

| Desktop | Mobile |
|---|---|
| Right-click context menu | Long-press on any card/message/document → bottom sheet, with haptic at 120 ms (+ optional peek preview) |
| `Ctrl/Cmd + K` command palette | Pull-down on Home, or the search field at the top of Library, plus a "Commands" entry in the Ask sheet. Also available from the tab bar via long-press on Ask. |
| Hover states | Pressed states only. Nothing may depend on hover. |
| Dock-style sidebar | Tab bar + sheets |
| Toasts | Snackbars above the tab bar, with haptics (success/info light, warning medium, error notification-style) and an optional action |
| Modal dialogs | Sheets (drag-to-dismiss, detents: 25% / 50% / 90%) |
| Scroll indicator | The content itself, plus overscroll rubber-banding that matches the platform |
| Keyboard shortcuts list | A "Gestures and shortcuts" page in You → Help |

### 7.3 The screens that must be designed in detail (not just implemented)

Each of these gets a spec in `docs/mobile/screens/` with states, measurements and
the interactions listed:

1. **Home** — the composer (with the border-beam/orb treatment reduced to a
   composited glow), recent work, the offline-demo entry, the pickup cards from
   the app's existing "PICK UP FROM YOUR RECENT WORK".
2. **Ask sheet** — attachments (camera, photos, files), mode (Flow/Search/Quality/
   Math/Replicate), model picker, voice.
3. **Chat** — the streaming answer, citations, source sheet, Humanize diff,
   tooltip cards as tool calls, message actions via long-press.
4. **Reader** — page-by-page PDF, highlight gesture (drag with handles, marker
   sweep), the two follow-up actions (*quiz this passage*, *undo*), summary sheet,
   progress, and the "N blocks above" capsule.
5. **Quiz** — one question per screen, large tap targets, timer, streaks, haptics,
   result card, Share Studio.
6. **Library** — search field with lanes visible while typing, saved pages,
   folders, tags, RSS recommendations, per-item long-press.
7. **Notebooks** — chat scoped to a notebook, with the scope visible at all times.
8. **Articles** — the editor, with images from Wikimedia, and the honest "this is
   easier on your computer" affordance for very long documents.
9. **Agent Flood** — the squad view: live per-agent status as a "radio room",
   scratchpad, budget meter, briefing. Companion scale and device scale are
   visually distinct and labelled.
10. **Workflows** — run, monitor, approve, read history. Building a large graph
    offers the computer.
11. **Coding (companion)** — diff review, approve/reject, run log, "open on your
    computer".
12. **You / Settings** — themes (all 12) with live preview, appearance (glass/
    frosted/solid), Privacy Shield, providers and keys, companion pairing and
    scopes, models (download/delete), notifications (off by default), advanced
    (export frame log, storage, cache), About (maker, components, MIT).
13. **Onboarding** — a short, honest first run: what the app is, the privacy
    posture chosen by default, connect a provider or use the offline demo, and
    "pair your computer" as an optional step that can be skipped and done later.
    Ends inside a running chat, exactly like the desktop's eight-step version.
14. **Companion pairing** — QR scan, pin confirmation, scope consent, connection
    status, revoke.
15. **States** — every screen's empty, loading, error, offline and permission-denied
    state is designed, not improvised.

### 7.4 Platform differences that are not negotiable

- **iOS**: safe areas and the Dynamic Island, the home indicator inset, native
  share sheet, native context menus on long-press where they feel right, Live
  Activity for the study timer, no persistent background execution (a long job
  gets a best-effort background task and then must be resumable), haptics through
  Core Haptics, dynamic type to at least 200%.
- **Android**: Material 3 where it does not fight the design system, predictive
  back, foreground service with a visible, dismissible notification for long jobs,
  widgets for the study timer and "continue reading", notification channels with
  per-channel controls, dynamic type and display size scaling, haptics through the
  vibrator API with amplitude control.
- **Both**: the design tokens, type scale, spacing, radius, motion curves and copy
  are identical. What differs is the *mechanism* (back, share, permissions,
  long-press menus) and only that. Keep a platform table in
  `docs/mobile/platform-differences.md` and never let the two diverge by accident.

---

## 8. The design documentation to produce (a deliverable, not an afterthought)

`docs/mobile/` — thirteen documents, each short enough to read, specific enough to
build from. Numbers, not adjectives.

| File | What must be in it |
|---|---|
| `00-principles.md` | Five principles for this app on a phone, each with a "therefore we do / therefore we do not" pair. Start from: *local-first is visible* (the app must show where data lives and what leaves), *one thumb*, *never lie about state*, *motion explains*, *no feature left behind*. |
| `01-tokens.md` | The token table: colours (dark surfaces `#0A0A0B`, `#131316`, brand `#6C8EEF` → `#A78BFA`, plus the semantic set: surface/raised/line/fg/muted/faint/brand/danger/success/warning), radius scale, spacing scale, elevation, blur policy, and the 12 theme mappings. Single source: `packages/tokens/tokens.json`, generated for Tailwind, Swift and Kotlin. |
| `02-type.md` | The type scale in `sp`/`pt` with Dynamic Type behaviour: roles (Display, Title, Headline, Body, Callout, Caption, Mono), size/line-height/tracking per role, maximum lines, truncation rules, and which roles are allowed to scale to 200% (all of them, with layout consequences spelled out). |
| `03-grid-and-layout.md` | 4 pt base, 8 pt rhythm; gutters 16 (phone) / 20 (large phone) / 24 (tablet); safe-area rules; the 44×44 pt / 48×48 dp minimum target with the exceptions (none); one-handed reach map; landscape (allowed only where it earns it: reader, video-free content, quiz results); foldables and tablets. |
| `04-navigation.md` | The tab bar (3 destinations + primary action), the sheet detents, the push depth limit, deep links, back behaviour per platform, and a diagram of every route. |
| `05-components.md` | Every component with a spec table: purpose, anatomy, sizes, states (default/pressed/loading/disabled/error), tokens used, haptics, copy rules, and the screen(s) it appears on. Include the mobile versions of the app's existing pieces: composer, answer block, citation chip, source sheet, quiz card, reader highlight, folder, agent row, job row, model card, scope row. |
| `06-motion.md` | Durations, curves, spring parameters, choreography per flow (open a chat, send, stream, highlight, answer a quiz, open a sheet, switch tab), reduced-motion behaviour, and the rule that motion never animates layout. |
| `07-haptics-and-sound.md` | A table of events → pattern (light/medium/heavy/notification/selection), and the rule that sound is off by default. |
| `08-accessibility.md` | VoiceOver/TalkBack labels for every screen's primary flow, contrast ≥ 4.5:1 for text, focus order, the 200% text test, switch control, the "one-handed" test, and the accessibility acceptance list. |
| `09-states.md` | Empty, loading (skeleton, not spinner), error, offline, unattached-companion, permission-denied, and "you are on a phone and this needs a computer" — each with the exact copy. |
| `10-performance.md` | The contract from Part 5, the quality ladder, the device floor, the benchmark scenes, and the ladder's user-visible states. |
| `11-latency.md` | The two tiers from Part 6, which operation belongs to which, and what the UI must do at 200 ms / 400 ms / 2 s. |
| `12-platform-differences.md` | The iOS/Android table, including what each platform cannot do and how the app says so. |
| `13-references.md` | The reference study from Part 9, with the specific patterns taken and the specific patterns rejected. |

Plus, in the app itself: a **design preview route** (`?design=1`, dev builds only)
that renders every component in every state at 390×844, 412×915, 320×568, 430×932
and a tablet frame, side by side, with a toggle for each of the 12 themes, each
text size (100%/150%/200%) and each quality level. A design that cannot be
inspected cannot be kept accurate — this is the mobile equivalent of the app's
existing Developer Mode UI lab.

---

## 9. References: how to use Awwwards, Dribbble and Refero

Use them as a **brief**, not as a mood board. For each of the three, the study is
a written output (it goes in `13-references.md`), with links and what was taken.

### Refero — for the flows we are actually shipping

Refero is organised the way this port needs to think: *page types*, *flows*, *UX
patterns*, *UI elements*. Before designing each screen, read the corresponding
reference set and write down the three decisions it settles:

- **Onboarding flow** → what a first run must show before asking for anything.
- **Chatting & messaging flow** → composer behaviour, streaming states, scroll
  ownership while an answer arrives.
- **Searching pattern** → how results appear while typing, and how empty results
  are explained.
- **Uploading & downloading flow** → progress, resumption, and what happens when
  the app is backgrounded mid-transfer.
- **Personalizing & customizing** → theme switching without a flash.
- **Activity & notification feed** → what belongs on Home and what does not.
- **Dark mode pattern** → surfaces and contrast on OLED, which is the app's default.
- **Navigation bar / Sidebar & drawer / Dialog & modal** → the mobile versions of
  the app's desktop chrome.
- **AI tool** sites → the current bar for an AI product's first screen.

Take: structure, sequencing, information density per screen, and how much a real
product shows on one phone screen. Do not take: another product's visual identity.

### Awwwards — for craft and for motion that means something

Study the mobile and Site of the Day work for the things that separate designed
from generated:

- **One idea per screen, given room.** Big type, generous spacing, one accent.
  Recent winners worth reading for exactly this: *WISPR FLOW* (momentum and flow
  made visible), *AP Transit — NYC Subway Map* (a dense data set made legible on a
  small screen), *miralife.app* (calm gradients, restrained motion), *Charmling*
  (character and playfulness without clutter), *Serus* and *Crow* (layout discipline
  in a monochrome palette).
- **Motion as explanation**, not decoration: a transition that shows where a thing
  came from; a progress state that shows what is happening.
- **Editorial typography on a phone**: a display face used once, at a size that
  earns it, with everything else quiet.

Take: craft, restraint, boldness in the one place it is spent. Do not take:
scroll-jacking, cursor-driven effects, hover-only reveals, or 12-second intros —
none of them survive contact with a thumb.

### Dribbble — for the component-level details

Use it for the pieces, not the whole: the tab bar's height and inset, the way a
pill dock sits above the home indicator with a raised primary action (the pattern
several well-liked dark-mode tab bars use), sheet headers with a grabber, empty
states, skeleton shapes, card density, and the icon-plus-11px-label tab item.
Search by what you need ("dark mode tab bar", "mobile chat UI dark", "reader
highlight ui") and translate what you find into tokens, not pixels.

Take: measurements, patterns, the small details that make a component feel
finished. Do not take: gradients that fight the app's accent, a second accent
colour, or a look that belongs to another brand.

### The anti-pattern list (each one is a rejection, with a reason)

1. A tab bar with five or six destinations — the app has three jobs; the rest are
   sheets.
2. A hamburger drawer as primary navigation.
3. Desktop hover affordances carried over ("hover to see the answer").
4. Text under 12 pt for content, under 11 pt for anything.
5. Touch targets under 44 pt (iOS) or 48 dp (Android).
6. `backdrop-filter` on scrolling content.
7. Parallax on a phone screen. It costs frames and it is not worth one.
8. Long, uninterruptible transitions.
9. A modal stack deeper than two.
10. `100vh` layout assumptions without safe-area and keyboard handling.
11. Lists that are not virtualized, because "the library is small" — it will not be.
12. Spinners where a skeleton belongs, and spinners with no sentence.
13. Progress with no cancel.
14. Any screen that shows a feature unavailable with no explanation and no path.
15. Animating layout properties.
16. A second accent colour. The app has one.
17. iOS-looking controls on Android or Material controls on iOS, for anything
    interactive: use each platform's mechanism and the app's own visuals.
18. Copy that sounds like it was written by a model ("unleash", "seamlessly",
    "revolutionize"). The app's voice is plain, specific and honest — see the
    website's copy rules; em dashes are not used in user-facing strings.

---

## 10. Privacy and security on a phone

The desktop app's promises have to hold here, or the port is a betrayal of the
product.

- **No account, no telemetry, no analytics, no crash reporter that phones home.**
  If crash reporting is ever added, it is opt-in, self-hostable, and off by default.
- **Keys in the Keychain / Android Keystore**, behind biometrics optionally; never
  in a plist, never in `localStorage`, never in a log line.
- **The library encrypted at rest** (SQLCipher or file-level), with the key in the
  secure store; the user can see the folder path but the files are not readable
  without the device.
- **The Privacy Shield enforced in Rust**, at the boundary where bytes leave:
  Privated scrubs secrets; Top Secret runs search locally only. A UI bug must not
  be able to bypass it, and the enforcement point is documented.
- **App switcher snapshot privacy**: blur the content in the snapshot, with a
  setting to control it.
- **Companion traffic** is pinned (SPKI), scoped, revocable, and local by default.
  The relay, if enabled, is E2E and self-hostable, and the UI says exactly what
  metadata leaves.
- **No third-party SDKs that collect** — no ad SDKs, no analytics SDKs, and every
  dependency that touches the network is listed in `docs/mobile/13-references.md`'s
  neighbour file `docs/mobile/security.md` with what it can see.
- **Data export is a first-class path**: the same ZIP export that exists on
  desktop, plus a per-item share, so leaving is as easy as arriving.

---

## 11. Platform constraints that shape the build (verify each, then write it down)

- **iOS review**: no downloading executable code; models as data are fine; the
  "companion" feature must be understandable to a reviewer in the binary's own
  copy; if the app can run without a computer (it must), say so in the review
  notes. Background execution is best-effort; long jobs must be resumable, and the
  UI must not promise otherwise.
- **Android**: foreground services need a visible, user-meaningful notification
  and a declared type; scoped storage rules for the library folder; battery
  optimisation prompts are user-hostile — instead, make long jobs resumable and
  let the platform's own scheduling do its thing.
- **Store updates replace the app's self-updater.** Keep the "what's new" panel fed
  by the same release notes, with a store deep link. Keep the fingerprint check for
  any sideloaded Android path.
- **Permissions**: request at the moment of use, one at a time, with the reason in
  the sheet ("this lets you attach the paper you are reading"). Never at launch.
- **Both stores** require the app to work without a network for its core loop,
  which this app does by design — that is a selling point in the listing, not a
  limitation to hide.

---

## 12. Deliverables

1. `mobile/` building for iOS and Android from one command each, signed
   Release builds produced by CI on tags.
2. `crates/` with the Rust core, unit-tested, with the SQLite schema shared with
   the desktop backend (migrations in one place).
3. `packages/tokens` generating Tailwind/Swift/Kotlin from one JSON, and
   `packages/prompts` shared verbatim with the desktop.
4. `docs/mobile/` — the thirteen documents, plus `screens/` with a spec per screen
   and `native-islands.md` if any screen needed one (with its numbers).
5. The companion server module on the desktop (routes + pairing UI + scopes),
   documented in `docs/mobile/companion.md`.
6. A test suite in the project's existing style: mounted component tests in jsdom
   equivalents where they apply, Rust unit tests for the core, and the
   **on-device benchmark harness** with budgets that fail the build.
7. An honest capability table published in the README: what runs on the phone,
   what needs the computer, and why — the same honesty the website's star band and
   macOS line already use.

---

## 13. Rounds (each ends with a build, tests, a push and a tag)

The project works in rounds. Keep the discipline: every round ends with something
installable, tests that prove what it claims, a release note, and no broken
previous round.

**R1 — the shell and the design system.**
Tauri 2 mobile building for both stores. Three-destination navigation, the token
pipeline, the type scale, the theme engine with all 12 themes, the design preview
route, and `docs/mobile/01–04`. Tests: tokens generated on both platforms match
the JSON; a theme switch repaints within 10 ms; the design preview renders every
component in every state.
*Acceptance: the app opens on an iPhone and a low-end Android at 60 fps idle and
120 fps where the panel allows, with the correct theme and safe areas.*

**R2 — the local core.**
`re-core`: SQLite, migrations, the library, the local search index, the job queue,
secure storage. No UI beyond what R1 built. Tests: 50 000 documents index and
query within the tier-1 budget; a kill mid-write loses nothing; the schema
matches the desktop's.
*Acceptance: a library copied from the desktop opens on the phone, and searching
it is ≤10 ms.*

**R3 — chat, answers and streaming.**
The composer, the ask sheet, the chat screen, the incremental streaming renderer,
citations, the pacing engine against the frame budget. Provider keys, the 17
providers, free routing, token accounting. Tests: `AnswerStream` holds the frame
budget with a 4 000-token answer containing three code blocks; time-to-first-
meaningful-paint ≤200 ms p50 on the network matrix.
*Acceptance: a real answer streams at full frame rate on both device classes, and
nothing on the screen waits on a spinner without a sentence.*

**R4 — reading, studying, writing.**
Reader with page streaming and the highlight gesture, the six quiz types, the
timer with Live Activity/persistent notification, notebooks, the article editor,
Share Studio, Humanize with the diff. Tests: `Reader300` holds its budget while
highlighting; 10 000 highlight records survive a relaunch; quiz generation works
offline with an on-device model.
*Acceptance: a student can open a PDF, read it, highlight it, take the quiz and
share a result without a network.*

**R5 — models on the device.**
`re-models`: the model manager, three size classes, the embedding model, the
inference path on Metal/NNAPI, the OS-model adapters, download/resume/verify/
delete. Tests: memory ceiling respected on the device floor; no UI frame drops
during inference; a model that cannot fit is refused *with a sentence*, not
silently swapped.
*Acceptance: answering offline on the device floor, with the frame budget intact.*

**R6 — the companion.**
Pairing, pins, scopes, discovery, resumable transport, the job protocol, the
degradation states. Desktop routes + pairing UI. Tests: pairing and revoking from
both sides; a flood submitted from the phone runs on the computer and streams
back; every companion-placed feature renders a truthful unpaired state.
*Acceptance: the computer runs a full Agent Flood while the phone watches it
live, and unpairing leaves every feature explained rather than broken.*

**R7 — the heavy features.**
Agent Flood at both scales, workflows (run/approve/history, with the desktop
affordance for building), coding review and approval, design-mode watching,
integrations, dictation with all three engines.
*Acceptance: every feature in the parity matrix is reachable on the phone.*

**R8 — the hardening round.**
Accessibility pass (200% text, VoiceOver/TalkBack, contrast), thermal soak,
battery measurement, startup work, the quality ladder with thermal inputs, the
frame-log exporter, crash-free session target, store assets and listing copy,
`docs/mobile/05–13`.
*Acceptance: the benchmark suite passes on the frozen device list in CI, and the
docs describe what actually shipped.*

**R9 — the honest round.**
Publish the capability table, the privacy page, the "what needs your computer"
page, and the store listings. Fix everything the previous rounds documented as a
known difference, or state it as a deliberate limit with a reason.

---

## 14. Definition of done (the checklist that closes the port)

- [ ] One command builds iOS; one builds Android; CI produces signed artifacts on tags.
- [ ] Every row of the parity matrix is reachable on a phone, verified by a test.
- [ ] The frame budgets pass on the frozen device list, in CI, with the numbers published.
- [ ] Tier-1 interactions are ≤10 ms on device, measured, and tier-2 operations are ≤200 ms p50 with truthful progress beyond it.
- [ ] No feature in the app is disabled, hidden or greyed out for performance reasons. The quality ladder changes fidelity only, and is visible to the user.
- [ ] `docs/mobile/` contains all thirteen documents, all screens specified, all copy written, and they match the build.
- [ ] The three reference studies are written down with links and decisions.
- [ ] The app works offline for the core loop, and every computer-needing feature explains itself when unpaired.
- [ ] Keys are in the secure store, the library is encrypted at rest, the Privacy Shield is enforced outside the UI.
- [ ] No telemetry, no account, no third-party collector.
- [ ] The README's capability table is honest, including the parts that need the computer.
- [ ] A person who has never opened a terminal can install it from a store, finish onboarding in under two minutes, and get an answer with sources.

---

## 15. Risks, and the plan for each

| Risk | What it looks like | The plan |
|---|---|---|
| The WebView cannot hold 120 fps for the reader or the editor | p95 outside budget with everything else tried | Native island for that screen only, decided by measurement, recorded in `native-islands.md`. Tokens still generated from one source. |
| On-device models drain the battery | A 20-minute session costs more than 15% | Hard memory ceiling, thermal-aware quality ladder, model size classes, and always offer the companion or a provider as the better path. Measure mAh/hour per feature. |
| iOS background limits break long jobs | A flood dies when the screen locks | Every long job is resumable and checkpointed; the UI says the job will continue when reopened; the companion is the recommended path for long runs. |
| The companion is a security surface | A paired phone could run commands on the computer | Explicit scopes, second confirmation for execution, a 60-second window, revocation on both sides, and a log the user can read. |
| Two platforms drift | iOS and Android look like two apps | One token pipeline, one component set, a platform-differences document, and a screenshot diff in CI on both platforms. |
| The port loses the app's honesty | Marketing copy creeps into the UI | The copy rules from the website apply: no em dashes, no "seamlessly", no unverifiable claim, every state tells the truth about what is happening. |
| Store review misunderstands the companion | Rejection or a delayed review | A review-notes document in `docs/mobile/`, an in-app explanation, and proof that the app is fully functional without a computer. |

---

## 16. The short version (if the reader only remembers one thing)

The phone is the app. The computer is the accelerator. The design is documented
before it is drawn, and every number in that documentation is checked on a real
device, on the oldest phone you support, before it is written down. Nothing on the
screen is ever allowed to lie: not a spinner without a sentence, not a feature
without an explanation, not a frame budget without a measurement.

*And nobody gets to call it a "mobile companion app". It is Research Engine,
running in your hand, on your data, on your device — with your computer doing the
heavy lifting when the heavy lifting is genuinely heavy.*
