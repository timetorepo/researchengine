# 1. Overview

## What the product is

Research Engine is a **local-first AI research assistant**. It runs on the user's
own machine, as a desktop app or as a web app served by a small local server. It
combines:

- a chat with many model providers, each reached with the user's own key;
- research tools: web search with citations, a document Library, a reader, a
  citation audit;
- study tools: quizzes, a learning path, spaced repetition, articles;
- automation: workflows, scheduled bots that can talk to each other, calendars;
- a coding workspace: local projects, live previews, parallel agents, a design mode;
- connectors to the user's own accounts and third-party services.

It is free and MIT-licensed (`LICENSE`). There is no account system and no
hosted backend. Data stays on the machine unless the user sends it to a provider
they chose.

## Principles that shape the code

These are not slogans. Each one changes how code is written here.

| Principle | What it means in practice |
|---|---|
| **Local first** | Chats and most state live in the browser's storage. The server keeps only a few tables (see [data](08-data-and-persistence.md)). The app works offline for everything except model and web calls. |
| **Bring your own key** | Provider keys are entered in Settings and encrypted in the browser. The server receives a key per request and never writes it to disk. |
| **Honest fallbacks** | With no key configured the app uses an on-device *demo* model, and the UI labels it. Search falls back through a ladder and says which rung answered. |
| **Nothing hardcoded that can drift** | Model lists are fetched live from each provider. Pricing is inferred by rules that explain themselves. ECC roles and skill packs are vendored with a pinned source. |
| **Bounded everything** | Context sent to a model is capped per piece. Caches are size-limited. Concurrency follows a resource profile. A long session must not grow without bound. |
| **Quality is not traded for speed silently** | Profiles change how much runs at once, not the quality of an answer. Heavy visual effects are switched off by an explicit eco mode or by reduced-motion, not by guessing at the hardware. |
| **Safe updates** | The updater may replace the program. It may never touch the user's library. A version that fails to boot is rolled back. |

## Technology stack

| Layer | Technology | Where |
|---|---|---|
| UI framework | React 19, React Router 6 (hash routing), Zustand 4 (state) | `frontend/` |
| Build | Vite, SWC React plugin, Tailwind CSS 4 | `frontend/vite.config.ts` |
| Motion | `motion` (Framer Motion), GSAP, View Transitions | `frontend/src/lib/ui/`, `hooks/useViewTransitions.ts` |
| UI kits | HeroUI, Aceternity, ReactBits, SmoothUI, SpaceUI, Skiper, Cult UI, Watermelon and others (vendored) | `frontend/src/components/ui/`, `smoothui/`, … |
| Rendering | react-markdown with remark-gfm, remark-math, rehype-katex; KaTeX; Three.js and React Three Fiber for some effects | `frontend/src/components/chat/` |
| Server | Node 20+ with Hono 4 and `@hono/node-server` | `backend/` |
| Database | SQLite via `better-sqlite3` (optional), `node:sqlite` (Node 22.5+), or an in-memory fallback | `backend/src/db/` |
| Desktop | Tauri 2 (Rust) with a Bun-compiled backend sidecar | `desktop/` |
| Website | Vite + TypeScript, deployed as static files | `website/` |
| Speech to text | Whisper via `@huggingface/transformers` in a Web Worker (meetings); provider or local engines (dictation) | `frontend/src/lib/meetings/`, `lib/voice/` |
| Tests | Plain `tsx` scripts with assertions, plus jsdom for UI checks | `frontend/scripts/`, `backend/scripts/` |

## Packages at a glance

```text
researchengine/
├── frontend/   React app (the UI)
├── backend/    Node server (the API, and it serves the built UI)
├── desktop/    Tauri shell (the native window and the sidecar lifecycle)
├── website/    Public marketing site
├── scripts/    Root build, packaging and CI helpers
└── docs/       This handbook, plus the older process notes
```

Each package is independently buildable. The root `package.json` declares the
npm workspaces (`frontend`, `backend`) and the top-level scripts.

## Version and status

- Current version: **1.1.0**, the version in every `package.json`, in
  `desktop/src-tauri/tauri.conf.json`, and in `website/`.
- Platforms: Windows 10/11 x64 and Linux x64/arm64 are the targets. There is no
  macOS installer and no macOS runner in CI, although the code runs there from
  source.
- Release history is in `frontend/src/lib/updates/changelog.ts` (generated from
  GitHub release notes) and in `downloads/`.
