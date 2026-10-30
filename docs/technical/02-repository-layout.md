# 2. Repository layout

## Top level

| Path | What it is |
|---|---|
| `package.json` | Root manifest. Declares the npm workspaces (`frontend`, `backend`) and the top-level scripts (`dev`, `build`, `start`, `desktop:*`, `site:*`). |
| `frontend/` | The React application. Builds to `frontend/dist/`. |
| `backend/` | The Node server. Builds to `backend/dist/index.js`. |
| `desktop/` | The Tauri 2 shell and its own npm package. |
| `website/` | The public marketing site. |
| `scripts/` | Root helpers: the dev launcher (`dev.mjs`), the sidecar builder, the desktop checker, the installer verifier, the ECC and skills vendoring scripts. |
| `docs/` | This handbook (`docs/technical/`) and the older process documents. |
| `downloads/` | Release notes for each published installer. |
| `.github/workflows/` | CI: `desktop.yml`, `website.yml`, `site-assets.yml`. See [release](10-desktop-website-release.md). |
| `Dockerfile.single` | A single-image build: one Node process, the built UI, and `/data` for the database. |
| `docker-compose.yml`, `compose.slim.yml` | Compose files. `docker-compose.yml` runs the frontend image, the backend image and an optional SearXNG. |
| `netlify.toml`, `vercel.json` | Hosting config for the website. |
| `.env.example` | Optional backend settings. Provider keys are *not* configured here. |
| `THIRD-PARTY-NOTICES.md` | Licences of vendored code. |
| `LICENSE` | MIT. |

## `frontend/`

```text
frontend/
├── index.html              Vite entry HTML
├── public/                 Static files copied as-is: sw.js (service worker),
│                           manifest.webmanifest, icon.svg, wallpapers/, lang-logos/
├── scripts/                Tests (*-test.mts), the build-time generators
│                           (build-changelog.mjs, build-personas.mjs, build-skills.mjs,
│                           build-mcp-catalog.mjs, vendor-*), and the render probes
├── src/
│   ├── main.tsx            React root, font and CSS imports, perf sync, service worker
│   ├── App.tsx             Providers, the route table, overlays, startup gates
│   ├── components/         296 .tsx files, grouped by feature (see below)
│   ├── content/            Vendored data: personas, skills (upstream packs), ECC agents
│   ├── hooks/              React hooks shared across features
│   ├── lib/                Non-UI logic, grouped by domain (see below)
│   ├── stores/             Zustand stores (main, UI, design, exam, notices)
│   ├── styles/             globals.css: theme tokens, base styles, motion keyframes
│   └── types/              Shared TypeScript types (index.ts) and module shims
├── vite.config.ts          Vite config: dev proxy, chunking, the version injection
├── tsconfig.json           `strict`, path alias `@/* → src/*`, no allowJs
└── package.json            Scripts and dependencies
```

### `frontend/src/components/` by feature

| Folder | Purpose |
|---|---|
| `layout/` | `Shell` (the window frame), `BackgroundLayer` (the global animated background) |
| `sidebar/` | Navigation, chat history, the Marketplace link, the privacy panel |
| `topbar/` | The top bar: model picker, resource meter, update badge, session switch button |
| `home/` | The landing screen: the composer, quick actions, recent items |
| `chat/` | The conversation view: messages, markdown, sources, the artifact panel, thinking display |
| `chats/` | The Chats page: all conversations, filtered by kind |
| `input/` | The composer: modes, attachments, `@`/`/` popup, voice, skills |
| `settings/` | Settings: one file per tab (providers, appearance, voice, services, about…) |
| `onboarding/` | First-run wizard |
| `library/` | Library: documents, saved items, videos with timeline notes, source viewer |
| `reader/` | The page reader used by the Library |
| `quiz/`, `learn/`, `exam/` | Quiz hub, Learn paths and spaced repetition, the exam gate |
| `articles/` | Article list and the block editor |
| `workflows/`, `workflows/wf/` | Workflow list, the graph editor and its nodes |
| `bots/` | Bots page: bot threads, group rooms, projects, the web and tools settings |
| `ide/` | Coding view: project tree, editor, terminal, preview, agents, tests |
| `design/` | Design mode: research board, brief, prototype, ship |
| `agents/` | Agent Flood view |
| `compare/` | Side-by-side model comparison |
| `meetings/` | Recording, transcript and notes |
| `calendar/` | Calendar view (iCal feed) |
| `wallet/` | Wallet view and the watcher that reports balances |
| `vault/`, `alpha/` | The unlock screen and the lock screen; the RemoverAlpha tool |
| `activity/`, `tasks/`, `notifications/`, `feedback/`, `dev/`, `easter/` | Activity tracking and rewards, tasks, notices, feedback, the bug finder, hidden screens |
| `os/` | Desktop-style chrome: the title bar, the dynamic island, the dock |
| `sessions/` | The session switcher (CardSwap deck of recent chats) |
| `shared/` | Cross-feature pieces: the command palette, toaster, error boundary, context menu, shortcuts overlay |
| `ui/` | Vendored UI kits (HeroUI wrappers, Aceternity, ReactBits, SmoothUI-style, SpaceUI, Skiper, Watermelon, Untitled UI, uiarc, Componentry). See [UI component system](11-ui-component-system.md). |
| `reactbits/` | ReactBits JS-CSS components vendored by hand (GooeyNav, CardSwap, backgrounds) with the licence notice |
| `backgrounds/` | Animated backgrounds and their manager; the ReactBits adapter |
| `smoothui/`, `shadcn-space/`, `spaceui/` | Vendored component folders from those libraries |

### `frontend/src/lib/` by domain

| Folder | Purpose |
|---|---|
| `chat/` | The send pipeline (`runChat`), streaming, tools, fork, humanize, markdown dialects, thinking phases, bubbles |
| `flow/` | The Flow engine: classifier, pruner (capsules), cache, pacer |
| `context/` | The context budget: caps on every piece sent to a model |
| `providers/` | Provider registry, model discovery, streaming adapters, keys, tiers (free or paid), context windows |
| `ecc/` | ECC role families and member selection |
| `bots/` | Bot logic (pure rules), the runner, the store, the web client, drafts |
| `services/` | Third-party services client and config (OpenSEO, VoiceStudio, Twenty, Postiz) |
| `integrations/` | Integration catalogue and client (search and read across configured services) |
| `composio/` | Composio client, connected-account activity |
| `connectors/` | Local connectors: Drive, Mail, Calendar and Files |
| `mcp/` | MCP server catalogue and the client-side handling |
| `context7/` | Documentation search client |
| `rag/` | Retrieval client and the citation audit |
| `search/` | Web search client with its fallback ladder |
| `library/` | Library items, embedding rules, citation formats, saved videos |
| `ide/` | Coding mode: projects, frameworks, commands, preview client, agents, tests, sample app, access scopes |
| `design/` | Design mode: provider catalogue, component search, directives, frameworks, the full pipeline |
| `meetings/` | Recording, transcription worker, meeting model, notes, storage (IndexedDB) |
| `learn/` | Learn: techniques, spaced cards, paths, the demo passage |
| `quiz/` | Quiz generation, share cards, confetti |
| `articles/` | Article image fetching |
| `workflows/` | Workflow types, the node library, templates, executor, variable injection |
| `skills/` | Built-in skills and the vendored skill packs |
| `personas.ts`, `prompts/` | Persona system prompts and the prompt library |
| `security/` | The lock, the vault gate, TOTP, the Trojan-horse detector, storage quota helpers |
| `crypto/` | The key vault (PBKDF2 + AES-GCM) and session handling |
| `storage/` | `deferredJson`, the batched persistence for Zustand |
| `system/` | Performance profiles, the frame-budget monitor, resource reading |
| `updates/` | The update client and the generated changelog |
| `notifications/`, `notify.ts` | The notification store and delivery |
| `privacy/` | Privacy Shield postures (none, private, top secret) |
| `usage/` | Daily token budget |
| `ui/` | Motion numbers, handoff between screens, skins, settings exit motion |
| `routes/` | Route registry (chunk prefetching) and the view-transition helper |
| `voice/` | Speech to text modes (browser, provider, local) and dictation |
| `wallet/`, `calendar/`, `activity/`, `profile.ts`, `themes/`, `backgrounds/` | Each is self-describing; see the [module reference](reference/modules.md) |

Every module's header comment says what it is for and why it exists. Read it
before changing the module; many headers record a past bug and the rule that
came out of it.

## `backend/`

```text
backend/
├── bin/research-engine.mjs   CLI launcher: runs the bundled dist, or tsx in a dev tree
├── src/
│   ├── index.ts              The app: middleware, route mounts, static files, boot checks
│   ├── runtime.ts            Flags, config, data-dir layout, profiles, port selection
│   ├── build-info.ts         Version and build fingerprint of this install
│   ├── static.ts             Serves the built frontend with SPA fallback
│   ├── db/                   schema.ts (Drizzle table definitions), index.ts (engines and SQL)
│   ├── routes/               One module per API area (~40 files, see the API reference)
│   ├── services/             Logic behind the routes: search, reader, RAG, integrations,
│   │                         Composio, Context7, system metrics, VirusTotal, agent access
│   ├── preview/              Coding mode: dev-server manager, path rules, worktrees, the
│   │                         Design-mode bridge script injected into previews
│   └── update/               The updater: version arithmetic, archive, backup, service, boot
├── scripts/                  Backend tests (*-test.ts) and the JSON API check
├── Dockerfile                Backend image
└── package.json              Hono, @hono/node-server, drizzle-orm (table types), esbuild, tsx
```

## `desktop/`

```text
desktop/
├── README.md                 How the shell is put together, its lifecycle
├── package.json              The Tauri CLI (`tauri:dev`, `tauri:build`)
├── ci/                       CI helpers for the desktop build
└── src-tauri/
    ├── Cargo.toml            Rust crate `research-engine-desktop` (Tauri 2)
    ├── tauri.conf.json       Product name, identifier, bundle targets, the sidecar
    ├── build.rs              Tauri build script
    ├── src/main.rs           Starts or reuses the server, waits for health, opens the window
    ├── binaries/             Where the compiled sidecar is placed before bundling
    └── icons/                App icons
```

## `website/`

A small Vite + TypeScript site. `src/components/site/` holds the page sections,
`src/components/` also holds vendored UI folders (`aceternity`, `shadcn-space`,
`smoothui`, `ui`, `uiarc`), `src/data/` the copy and the release facts, and
`scripts/` the asset preparation (`prepare-assets.mjs`), the vendor step
(`site-vendor.mjs`) and the site test. Details are in [chapter 10](10-desktop-website-release.md#the-website).

## Generated and vendored content

Some folders are produced by scripts, not written by hand. Do not edit them:

| Folder or file | Produced by |
|---|---|
| `frontend/src/lib/updates/changelog.ts` | `frontend/scripts/build-changelog.mjs` (from GitHub release notes) |
| `frontend/src/content/mcp-catalog.json` | `frontend/scripts/build-mcp-catalog.mjs` |
| `frontend/src/content/personas/` (text and `manifest.ts`) | `frontend/scripts/build-personas.mjs` |
| `frontend/src/content/skills/` (`catalog.ts`, upstream packs) | `scripts/vendor-skills.mjs`, `frontend/scripts/build-skills.mjs` |
| `frontend/src/content/ecc/` (ECC agent definitions) | `scripts/vendor-ecc-agents.mjs` |
| `frontend/src/components/smoothui/`, `shadcn-space/` (vendored folders) | `frontend/scripts/smoothui-registry.mjs`, `frontend/scripts/shadcnspace-vendor.mjs` |
| `docs/technical/reference/*.md` | `docs/technical/tools/generate-reference.mjs` |
| `frontend/dist/`, `backend/dist/`, `desktop/src-tauri/binaries/` | Build outputs. Git-ignored. |
