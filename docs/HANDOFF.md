# Research Engine — session handoff

Everything a new session needs to pick this up without losing speed: what the
product is, what it has, how the work has been done round after round, the
exact commands, the environment's traps, and the user's standing rules.

State at time of writing: branch `arena/01a0b91b-researchengine` at `82033bb`,
newest release `v0.40.0-beta.1` (tag → `a435249`). A new session should branch
from that tip (or the tag) and be told to continue from it.

---

## 1. What Research Engine is

A local-first AI research assistant: Tauri desktop app + the same app served
by its own Node backend, plus a marketing website. The pitch the UI itself
makes: "the swiss knife of AI research", free and local, unlike the seven
paid apps it names on the onboarding Free step.

Stack:

- `frontend/` — React 18 + Vite + Tailwind + `motion/react` (framer), zustand
  stores, react-router (hash routing). Builds to `frontend/dist`.
- `backend/` — Hono server, `node:sqlite` (experimental flag), esbuild bundle
  at `backend/dist/index.js`. Serves the API and the built frontend in one
  process (`npm start` → port 3847).
- `desktop/` — Tauri shell wrapping the same frontend/backend (sidecar).
  Rust never compiles in the dev sandbox; installers come from CI.
- `website/` — Vite marketing site (Netlify), reads the root version.

Single-process mode: `npm start` runs `backend/bin/research-engine.mjs serve
--port 3847`; bind with `RE_HOST=0.0.0.0` for the Arena live preview.

## 2. Feature inventory (as of 0.40.0-beta.1)

### Chat / research core
- Modes in the composer: Flow (AIFlowEngine token-efficient context), Search
  (citations, Cmd/Ctrl+Enter), Quality (longer cited answers), Math
  (step-by-step LaTeX), Replicate (staged replication plans). Since 0.40 the
  three-lines button unfolds these sideways as pills with hover tooltips
  (`ModeStrip`), no popover menu.
- Providers with step-by-step key guides (`lib/providers/key-guides.ts`,
  19 guides incl. Xiaomi MiMo), free/paid labelling, model discovery,
  per-provider client-side timeouts, local demo model without keys.
- Fork with deterministic context compression (capsules), humanize rewrite
  (chat only, never Coding), thinking indicator, tool cards, source cards
  with favicons, diff-based message editing, approval cards for destructive
  actions.
- Onboarding: 8 steps, last one runs a real chat; Aceternity set pieces
  (AppleCardsCarousel, ContainerTextFlip over CanvasRevealEffect,
  DottedGlowBackground), real repo star count, no stock images.
- Read & Quiz ("like Apple built a quiz mode"), articles editor, workflows
  (animated, scroll-back), Agent Flood, Compare, RemoverAlpha (no token
  cost), voice/STT (Voice by Jakub Antalik + ReactBits Micro), notifications
  off by default.

### Library
- Expanded search with labelled verticals: web (SearXNG auto-setup then
  DuckDuckGo), wikipedia, screens (URL-grammar matching for Awwwards/
  Dribbble/Refero/Mobbin), ui (Refero/Mobbin patterns + the app's own
  component catalog), docs (MDN/React/Tailwind/shadcn/Tauri/Hono/Zod/Motion);
  plus the "app's own search" mini engine (`backend/src/services/reader/mini.ts`).
- Reader: Wikipedia through its own API, everything else reduced server-side
  to blocks; SourceViewer squircle panel with Read and Browser tabs, outline
  rail, save-to-folder. Since 0.40: answers are normalized before render (the
  viewer can no longer crash the app) and the Browser tab has a Direct /
  Proxied switch backed by the local embedding proxy `/api/proxy`
  (`backend/src/services/reader/proxy.ts`): fetches in the server, drops
  base/CSP/frame-busters, absolutizes subresources, loops anchors through
  itself; SSRF-guarded (public http(s) only). Policy-hostile hosts (awwwards,
  dribbble, refero, …) start proxied; the hostile list exists once per side
  (`frontend/src/lib/library/embed.ts` and the backend file) and a test fails
  if they drift.
- Folders: blue macOS-folder squircles (FolderReveal, hover opens, click
  shows saves), scroll-keeper so opening never jumps the page.
- Recommendations as an RSS-style feeder: dated, grouped by day, tag/feed
  watches, dismiss remembered.
- Agent tools: `library_search`, `library_read` — the agent reaches all of it.

### Coding workspace (Xcode 26 / Cursor 3 / Zed taste)
- Panels-on-a-canvas workbench: glass bar with grouped pills, breadcrumbs,
  gliding file tabs, agent dock with live timers and per-file accept/leave
  diffs, review bar, status pills; welcome window for empty projects;
  non-repeating motion per interaction (guarded by ide-chrome-test).
- 0.39/0.40 interiors: file-kind glyphs and colours in tree and tabs
  (`lib/ide/fileIcons.tsx`), splittable bottom panel (drag 140–560 px,
  remembered, double-click resets), current-line wash riding caret+scroll.
- Agents: scoped computer access enforced server-side, VirusTotal ledger for
  downloads (before and after, "not checked" said plainly when unconfigured),
  slash commands, /handoff, 27 framework templates, sample-app generator.
- IDE follows the active theme; title-bar project name inline-editable;
  chatbox pill; terminal in the panel.

### Design mode (a tab of the coding workspace)
- Panes: assistant, inspect (pick mode with theme-colour marquee drawn inside
  the preview frame), tests, console, captures (filmstrip), board, brief,
  hub, inspo, prototype (four device frames at once), ship.
- Inspiration board browses Awwwards, Dribbble, Refero, unicorn.studio
  **inside the app** through the SourceViewer (Read + Browser/proxy), address
  bar, back-trail, keep-as-reference.
- Component hub: 30 providers (namespaced shadcn registries, URL registries
  incl. Aceternity + SmoothUI, packages, copy-paste libs), per-manager install
  commands, dependency box. Since 0.40: preview stage — live demos for the
  vendored set (`lib/design/liveDemos.tsx`, 28 demos, light/dark stage,
  per-demo error boundary) and an honest card for the rest; Library UI hits
  open the hub already searching (`/code?hub=…`).

### Integrations
- Real adapters (Google Drive, Gmail, Google Calendar, GitHub, Notion, Slack,
  local files), credentials encrypted in the browser vault, server keeps no
  copy, "connected" only after the service says yes (probe), agent tools
  `integration_search` / `integration_read`.
- Since 0.40: step-by-step tutorial wizard (`IntegrationTutorial.tsx` +
  `lib/integrations/guides.ts`), reachable from Settings → Integrations and
  the composer's plug menu.

### Shell / top bar
- Live CPU/RAM/GPU meter (`/api/resources`), privacy shield, focus pomodoro
  pill, context-window ring, update pill + HeroUI-styled update modal,
  fullscreen toggle (0.40), Developer Mode build badge, UI lab (tests agent-
  made UI only), performance governor with live fps, thirteen themes,
  Appearance-driven gradients, macOS-folder blue taken from the accent in
  oklch.

### Updates
- `frontend/src/lib/updates/changelog.ts`: every release, newest first
  (32 versions at 0.40), selectable per version, generated from GitHub
  release bodies by `scripts/build-changelog.mjs`; updater with ranged
  resume, rollback on repeated failure, never corrupts data.

## 3. How the workflow works

Work arrives in rounds. Each round: read the asks literally, explore the
relevant files, implement in small patches keeping `tsc --noEmit` clean after
every patch, add or extend a regression test that asserts real behaviour
(mount components in jsdom, click things, read the DOM — source-string checks
only as a second layer), run the affected suites plus the big ones, build,
restart the preview so the user sees the real bundle, commit with a prose
message describing what changed and why, push to the session branch only.

Rules that came from the user and are enforced on myself:

- Verify before claiming. If asked "did you actually do X", answer literally
  about what is in the diff; structure vs interiors distinctions included.
- Never break existing UI; every fix carries a test that fails if it regresses.
- Nothing downloads or deploys without the user's signal; builds run
  automatically on any build prompt.
- Commits and pushes go only to the session branch
  (`arena/01a0b91b-researchengine` here). Never force-push. When a push is
  rejected because external work landed (it happened: a README commit),
  fetch, rebase the local commit on top, re-tag if the tag was local-only.

### Release cut recipe (the 0.37→0.40 pattern)

1. Bump `0.X.0-beta.1` in: root/backend/frontend/desktop `package.json`,
   root `package-lock.json`, `desktop/src-tauri/{Cargo.toml,tauri.conf.json}`,
   `website/src/lib/release.ts`, `website/src/components/site/AskStream.tsx`.
   (Do NOT sed AboutTab or changelog.ts — edit those by hand.)
2. Add the About entry (`AboutTab.tsx`) in house style.
3. Write `downloads/release-notes-0.X.0-beta.1.md`. The changelog generator
   needs an opening paragraph ≥110 chars (becomes the summary) AND a second
   long paragraph (becomes the "What changed" section) — with one paragraph
   only, the section silently disappears and updates-ui-test fails.
4. `npm run build`; `tsc` both workspaces; run the suites.
5. Portables: `npm run package:binary -- --target linux-x64|win-x64`, verify
   `./research-engine --version`, archive into `downloads/` as
   `research-engine-0.X.0-beta.1-{linux-x64.tar.gz,win-x64.zip}`, write
   `downloads/SHA256SUMS`, delete the previous version's archives.
   IMPORTANT: package AFTER the final changelog regen, or the shipped Updates
   tab tops out at the old version (this bit once; the portables were
   refreshed in a follow-up commit).
6. Bench: `frontend/scripts/bench-report.mts --api http://127.0.0.1:3847
   --out ../downloads/bench-report-0.X.0-beta.1.txt` (expect 8/8).
7. Commit `release: 0.X.0-beta.1`, annotated tag `v0.X.0-beta.1`, push branch
   and tag. `gh release create v0.X.0-beta.1 --prerelease --notes-file …
   --target <40-char sha>`.
8. Watch the tag's desktop CI run (`gh run list` → event push, headBranch
   `v0.X.0-beta.1`; `gh run watch <id>`). It uploads the three installers
   (exe, deb, AppImage) via softprops/action-gh-release.
9. `gh api repos/timetorepo/researchengine/releases/tags/v0.X.0-beta.1 --jq
   '.assets[] | "\(.name) \(.size) \(.digest)"'` → write
   `downloads/INSTALLERS.sha256`, commit, push.
10. Changelog: `gh api 'repos/…/releases?per_page=40' --jq '[.[]|{tag:.tag_name,
    name:.name,date:(.published_at[0:10]),url:.html_url,body:.body}]'` to a
    json file, prepend the just-cut release if missing, then from frontend/
    `node scripts/build-changelog.mjs --from <that file>`; updates-ui-test
    34/34; rebuild; commit; push; restart the preview.

### Commands cheat sheet

- Typecheck: `cd frontend|backend && node ../node_modules/typescript/bin/tsc --noEmit`
  (NEVER `npx tsc` — it installs a decoy `tsc@2.0.4`).
- Tests (from `frontend/`): `node ../node_modules/tsx/dist/cli.mjs --tsconfig
  tsconfig.json scripts/<name>.mts`.
- Build: `npm run build` at the root (frontend vite + backend esbuild).
- Preview: `RE_HOST=0.0.0.0 npm start` (start_process, port 3847).
- Backend has no `.bin/tsx`; run backend tests via the frontend tsx path or
  `npm run api:json-test`.

## 4. Test map (green at 0.40)

r27 47 · render-check 857 · r17 107 · smoke 65 · ui 60 · library 58 ·
integrations 51 · r18 54 · ui-lab 44 · design-browse 38 · r18-ui 37 ·
workbench 36 · ide-chrome 35 · updates-ui 34 · resilience 33 · fork 32 ·
r17-ui 31 · bridge-pick 24 · resources 19 · api-json 11 · nav-repro OK ·
bench 8/8. `design-test`/`sample-test` need a backend on :8787 (they read
`RE_API`); start one before running them.

## 5. Environment facts and traps (the expensive ones)

- The sandbox has NO outbound network: backend fetches fail ("fetch failed"),
  mini-search network verticals fail by design, Node TLS is blocked. Reader
  and proxy logic is therefore tested offline (pure functions + jsdom).
  On the user's machine everything fetches for real.
- Tauri/Rust cannot compile here — installers come from the tag CI only.
- Sandbox resets wipe `node_modules`, both dists, `.tools`: `npm install` at
  the root + `npm run build` afterwards. After a reset the git index can be
  stale and show hundreds of phantom modifications — cure:
  `git fetch --depth=1 origin arena/01a0b91b-researchengine &&
  git reset --mixed FETCH_HEAD`. Never `git add -A` over a phantom diff.
- jsdom harness needs: `requestAnimationFrame` shim, `ResizeObserver`,
  `matchMedia`, `getBoundingClientRect` stub; jsdom has no `fetch` (use Node's)
  and no layout (guard `clientHeight>0 && scrollHeight>0`).
- Scrolling: only `lib/dom/scroll.ts` (`scrollChildIntoView`); never the
  browser's `scrollIntoView` (it scrolls ancestors the app keeps still).
- Frame rules: html/body `height:100%`, `#root{overflow:hidden}`; views own
  their scrollers. `hooks/useViewTransitions.ts` must call the original
  pushState first.
- `gh release view --json targetCommitish` lies for tag releases; trust
  `git ls-remote` + the releases API. Release bodies are set at creation;
  edits need `gh release edit --notes-file`.
- Scratch TS files do not run from /tmp; put probes in `frontend/scripts/`.
- An apostrophe inside single quotes in a `.mts` breaks esbuild; chain shell
  edits with `;` not `&&`; kill servers by pid, find listeners with `ss -ltn`.
- `image-search/` (repo root, untracked) holds the R24/R26 reference renders
  (Xcode 26 liquid glass, Zed, Cursor 3) that inform chrome decisions.
- Website `site-test` cannot run here (needs website deps + public/release.json);
  the website CI judges it.
- Tags that exist: v0.40.0-beta.1 → a435249, v0.39.0-beta.1 → c548b8f,
  v0.38.0-beta.1 → feb1527, v0.37.0-beta.1 → b18e899, site-shots → 00cd8f2
  (never reopen), main 63323bb, refs/pull/2/head never reopened.

## 6. The user's standing rules (carry into every round)

Verify before claiming; answer "did you actually…" questions literally about
the diff. Full revamps mean revamps, not touch-ups. No `**` and no AI-sounding
copy in user-facing text; no stock images; no overlapping text; footer button
never white; hero must not look vibe-coded. Everything local on device; heavy
features fall back to the computer; state latency as 10 ms or 200 ms. Enter
runs search; responses inside ~200 ms or a neat error. Notifications off by
default. Actually USE the installed component libraries (HeroUI, SmoothUI,
Aceternity, ReactBits, shadcn-space, Watermelon, skiper) — each with a job.
Library = Wikipedia + trusted sources + own docs + blue squircle folders.
Updates lists every changelog, per-version selectable. Micro-interactions
move in sync and never repeat the same motion twice. Do not break any UI.
Fork compresses the prompt but keeps results. Reading-mode highlight is
automatic. Tauri rebuilds only on major updates; installers on every release.
The mobile-port brief lives in `docs/mobile-port-prompt.md`.

## 7. Open threads for the next session

- The embedding proxy's live fetch path is untested in-sandbox (no network);
  its rewrite/SSRF behaviour is covered offline. First real-world check:
  open an Awwwards reference in Design mode on the user's machine.
- `design-test` / `sample-test` were last run with a server on :8787; start
  one (`RE_HOST=0.0.0.0 node backend/bin/research-engine.mjs serve --port 8787`)
  before quoting them green.
- The preview process must be (re)started with start_process each session
  (`RE_HOST=0.0.0.0 npm start`); it dies with the sandbox.
- `downloads/` keeps growing per cut; older notes/bench files are historical.
