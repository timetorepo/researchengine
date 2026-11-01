# 7. Feature areas

This chapter maps each product area to the code behind it: what it does, where
the code is, and what to read first. Where a feature has a browser part and a
server part, both are listed. Route paths are in
[chapter 5](05-frontend.md#routing). Endpoints are in
[reference/api-routes.md](reference/api-routes.md).

---

## Chat, Chats and Home

**What it does.** The conversation with any configured model: modes, sources,
tool cards, artifacts, forking and humanize. The Chats page lists every
conversation and filters them by kind (All, Research, Coding) with a GooeyNav
switch. Home is the landing composer.

**Code.**
- `components/chat/` (conversation), `components/chats/ChatsView.tsx` (list),
  `components/home/` (landing), `components/input/` (composer).
- `lib/chat/` holds the send pipeline. See [chapter 6](06-chat-engine.md).
- `components/chat/ArtifactPanel.tsx` and `lib/artifacts/`. Code in an answer can
  be opened in a panel with a live local preview.
- `lib/chat/fork.ts` builds a capsule for a forked chat, so the new chat carries
  the meaning of the old one without copying every message.

**Composer popups.** Typing `@` or `/` opens a popup for Connectors and Skills.

**Thinking display.** The chain of thought streams while the model thinks and
folds away when the answer text starts. The phases come from
`lib/chat/thinking-phases.ts`.

---

## Sessions and the session switcher

**What it does.** Sessions are conversations that keep running on their own, so
one can stream while you work in another. The session switcher is a deck of
recent chats, built with ReactBits CardSwap. It opens from the top bar, or with
the shortcut (alt+shift by default).

**Code.** `components/sessions/SessionSwitcher.tsx` renders the deck and handles
the keyboard. `components/topbar/TopBar.tsx` opens it.

**Isolation.** A chat can be asked to run its work in a Docker container or a VM.
`backend/src/routes/sandbox.ts` probes what is installed first. A machine without
Docker or multipass is told so. No fake sandbox is ever shown.

---

## Library

**What it does.** Your saved material: documents you import, sources you save from
answers, folders, and saved YouTube videos with timeline notes.

**Search.** One query goes to two places at once, and the results keep them
separate rather than blending them: Wikipedia (its own API) and trusted web sources
(the same search ladder the chat uses; see [backend](04-backend.md#search-ladder)).

**Code.**
- UI: `components/library/` (`LibraryView`, source viewer, video view and
  timeline), `components/reader/` (page reader).
- Client: `lib/library/` (items, embed rules, citation formats, videos).
- Server: `backend/src/routes/library.ts` (the search lane) and
  `backend/src/services/reader/` (article extraction, feed reading, HTML reduction,
  and the embedding proxy).
- Storage: the `library_items` and `library_folders` tables.

**Pages that refuse to be framed.** Some sites send headers that stop them loading
in a frame. The embedding proxy (`services/reader/proxy.ts`, reached through
`GET /api/proxy`) fetches the page on the server and hands it to the reader
without those frame-blocking headers. The header comment gives the reason: it is
the user's own app reading a page the user chose.

**Citations.** `lib/library/citations.ts` produces citation formats for the page
on screen.

**Videos.** A saved video can have *timeline notes*, each pinned to a moment.
You can write them, or the AI can write them from a transcript or description you
paste. The model is `{ id, at, text, by: 'user' | 'ai', createdAt }`. The parsing
and prompt are in `lib/library/videos.ts`.

---

## Learn, Quiz and Exam

**Learn.** `lib/learn/techniques.ts` names and explains study techniques.
`lib/learn/cards.ts` builds spaced-repetition cards. `lib/learn/path.ts` builds a
learning path from a document. `lib/learn/demo.ts` holds a demo passage, so the
screens have something to show before any model is configured.

**Quiz.** `components/quiz/` and `lib/quiz/`. Questions come from a document. The
share card is drawn to a canvas (`lib/quiz/shareCard.ts`).

**Exam.** `components/exam/Exam.tsx`. Under Learn, the Exam tab asks you to accept
the rules. While an exam runs, `ExamGate` is a full-screen overlay above the app
that swallows the app's keyboard shortcuts until the exam finishes.

---

## Articles

A block editor for articles, with image search (`lib/articles/images.ts`).
Code: `components/articles/`. Routes: `/articles` and `/articles/:id`.

---

## Workflows

A graph editor for multi-step work. Each node has a kind, and the nodes run in
order, passing values along.

**Node kinds** (`lib/workflows/library.ts`): `trigger`, `ai`, `skill`,
`integration`, `transform`, `logic`.

**Variables** (`lib/workflows/vars.ts`): `{{input}}`, `{{item}}`,
`{{<node label>}}`, and `{{<node label>.path.to.value}}` to reach into a result.

**Code.** `lib/workflows/executor.ts` runs the graph. `lib/workflows/templates.ts`
holds starting templates. The editor is in `components/workflows/`.

---

## Bots

Bots are named teammates. Each has a job, its own thread, a memory it keeps, and
routines that run on a schedule. Bots can also meet in a *room*, which is a group
chat between bots, and a *project* can be handed from one bot to another with a
written brief.

**Limits** (`lib/bots/logic.ts`):

| Limit | Value |
|---|---|
| Routines per bot | 50 |
| Shortest routine interval | 5 minutes |
| Runs kept per routine | 20 |
| Thread length | 300 messages |
| Memory notes per bot | 100 (30 are included in each prompt) |
| Turns per room discussion | 6 |
| Members per room | 6 |
| Rooms / projects | 30 / 100 |
| Tool steps per reply | 3 (`MAX_TOOL_STEPS`) |

**How a reply is produced** (`lib/bots/runner.ts`, `converse`). The system prompt
is built from the bot's job, memory and role. The reply streams into a *draft*
(`lib/bots/drafts.ts`), which is kept apart from the bots store because it changes
on every token. When the reply is complete, it is saved as a message.

**Tool grammar.** A bot does not use the model's tool-call API. It writes commands
in plain text, and `findToolCall` in `logic.ts` reads them:

| Command | Does |
|---|---|
| `SEARCH: <query>` | Web search |
| `OPEN: <url>` | Read a page |
| `FIND: <text>` | Find text in the page last read |
| `TOOLS:` / `APPS:` | List connector tools, or connected apps |
| `RUN: <tool>` | Run a connector tool |
| `DOCS: <query>` | Documentation search |
| `SEO:`, `CRM:`, `SOCIAL:` | The business services |

**Group rooms.** `runRoomTurn` picks the next speaker (`pickSpeaker`) and gives
each bot the room's context. A bot can pass (`PASS`). Mentioning a bot by name
gives that bot the next turn.

**Handoff.** `handOffProject` writes a brief for the receiving bot
(`buildHandoffPrompt`). If the model call fails, `fallbackBrief` writes one from
the project's history instead, so a handoff does not stall on a broken connection.

**Routines.** `startBotScheduler()`, started from `App.tsx`, runs due routines.

**Web for bots.** `backend/src/routes/botweb.ts`. Search goes to SearXNG. Set your
own instance in Bots → Web, or with `SEARXNG_URL` on the server. Without one, the
app's public-instance ladder answers. Page reading uses the app's reader by
default. If you run a headless browser in Docker (the file's example is
`browserless/chrome`), give its address in Bots → Web, and pages are rendered
there first, so JavaScript-heavy sites work.

**Export.** `makeBundle` and `readBundle` export and import bots, rooms and
projects in one file (format `research-engine.bots`) and remap ids on import.

---

## Coding mode (IDE)

**What it does.** Local projects with a file tree, an editor, a terminal, a live
preview, parallel agents, and a test runner. The AI works on the project through
tools, and destructive steps ask first.

**Code.**
- UI: `components/ide/` (project tree, editor, terminal, preview, agent panel,
  test runner, Git panel).
- Client: `lib/ide/` (projects, frameworks, commands, preview client, agents,
  tests, access scopes, download ledger).
- Server: `backend/src/routes/ide.ts` (projects, files, Git, the command runner),
  `routes/preview.ts` and `preview/` (dev servers, the in-page bridge, and
  per-agent worktrees).

**Frameworks.** `lib/ide/frameworks.ts` lists the frameworks the IDE knows how to
create, run and test.

**Parallel agents.** `lib/ide/agents.ts`. Each task has an id, its own chat and,
on the server, its own worktree, so two agents do not write the same file.

**Test runner.** `lib/ide/tests.ts`. A test is a list of steps (click, type,
navigate, wait, assert, snapshot) run against the live preview. The `run_ui_test`
tool uses the same engine.

**Agent access.** Chosen by you, and enforced on the server
(`backend/src/services/agent-access.ts`):

| Mode | The agent may reach |
|---|---|
| `project` (default) | The open project folder |
| `selected` | The project and the folders you name |
| `full` | The whole computer |

**Downloads.** Anything the agent downloads is checked by VirusTotal before it
starts, by URL, and again after the bytes arrive, by SHA-256
(`backend/src/services/virustotal.ts`). A missing key gives `unconfigured`, never
`clean`. The client keeps a ledger (`lib/ide/downloads.ts`).

**Sample app.** `lib/ide/sample.ts` is a small static page with deliberate
accessibility and layout problems. Use it to try the audit and test tools.

---

## Design mode

**What it does.** A design workflow with six surfaces: **research** (references),
**brief** (a questionnaire that turns vague wishes into specifics), **board** (a
Stitch-style board), **hub** (a component hub across providers), **prototype** (a
live check of the design) and **ship** (the one step that touches the project).
**Full Throttle** runs the six as one pipeline.

**Code.** `components/design/` (ComponentHub, ComponentPreview, DependencyBox,
DesignBoard, DesignBrief, DevicePreview, InspirationBoard, PrototypeBoard,
ShipPanel, ThrottlePanel), `lib/design/` (providers, component search, directives,
frameworks, the pipeline), and the `useDesign` store.

**Agent tools.** `design_*` tools drive the rendered page: preview, navigate,
snapshot, inspect, click, type, resize, screenshot, assert, console, audit and
controls. They use the preview bridge from the IDE.

**Providers.** `lib/design/providers.ts` is the component-provider catalogue.

---

## Agent Flood

Several agents work on one question in parallel, and their results are
synthesised. The number running at once follows the profile's `floodWorkers`
setting (see [backend: profiles](04-backend.md#profiles)). Code: `components/agents/FloodView.tsx`,
`lib/chat/generate.ts` (the one-shot generation helper), and the server-side
coordinator `backend/src/services/agents/orchestrator.ts`.

---

## Compare

Side-by-side answers from several models to the same prompt. Code:
`components/compare/` and the `/compare` route.

---

## Replicate

A research mode that turns a technology into a staged replication plan: source
discovery, principle extraction, mechanism, replication guide, anti-patterns and
primary-source pointers. It is a mode of the chat (`lib/chat/replicate.ts`), not a
separate page. Each stage is shown as it runs.

---

## Meetings

**What it does.** Records a conversation on the device, transcribes it as you go,
and writes notes from the transcript.

**Pieces.**
- `lib/meetings/live.ts` captures the microphone.
- `lib/meetings/session.ts` holds the one active recording outside any React
  component, so leaving the Library does not stop it.
- `lib/meetings/transcribe.worker.ts` runs a Whisper speech model through
  `@huggingface/transformers` in a Web Worker. The first run downloads the model,
  and it then works offline.
- `lib/meetings/notes.ts` writes notes from the timed transcript and your own
  notes, using the configured model and a template from
  `lib/meetings/templates.ts`.

**Storage.** Recordings are kept in IndexedDB (database `re.meetings`), because a
meeting can be large. Nothing leaves the device except the notes request sent to
your own model.

**Code.** `components/meetings/` and `lib/meetings/`.

---

## Connectors

Connectors are accounts the AI can read through tool calls. There are two families.
The Composio apps are connected in the Marketplace, one page per app; see
[chapter 15](15-search-marketplace-crm.md#2-marketplace).

**Local connectors** (`backend/src/routes/connectors.ts`). Local Files, Drive, Mail
and Calendar. Each item is stored as JSON under `<data-dir>/connectors`. The AI
reads them through `connector_search` and `connector_read`. The file header says
it plainly: nothing leaves the machine.

**Composio** (`backend/src/routes/composio.ts`, `services/composio.ts`,
`lib/composio/`). Composio provides OAuth connections to many apps. Your project
key is encrypted in the browser and sent with each request. The sign-in page opens
in your default browser, the one that already holds your logins, through
`POST /api/composio/open`. `lib/composio/activity.ts` notices connects and
disconnects, including ones made on Composio's own website, and updates the
Connected tab.

**Connecting one app** (`MarketplacePage.tsx`, `ConnectButton`). Each app's button
keeps one *flight* (`Flight` in the file) and changes shape as it goes:
`Connect` → `Connecting` (spinner, while the sign-in window is open) →
`Connected` (check), or `Failed` (an X in a circle). Clicking `Failed` starts again.
Where the sign-in opens depends on where the app runs:

- **Desktop app.** The server runs on this computer, so `POST /api/composio/open`
  starts the default browser here. The server waits for the opener's exit code, so
  a missing browser is reported as a failure, not a success.
- **Browser tab.** The tab is opened on the click (a window opened later is blocked).
  If the browser still blocks it, the button shows *Open sign-in* for the person to
  press. The server is never asked to open a page when it runs on another machine.

A flight ends in one of four ways, each with a HeroUI toast that says which:
`closed` (the sign-in window was closed before the account appeared; offers a
new link), `timeout` (five minutes passed; offers a new link), `error` (Composio
or the network failed; suggests another default browser or checking back later),
and `opener` (no browser could start; offers to copy the link). A new account for
the app ends the flight as connected, whichever way it was made.

**The marketplace** is `components/marketplace/MarketplacePage.tsx`, a routed page
(formerly the Connectors popup). It has the Apps, Built in and Connected segments.
Each app has its own page with what the AI can do once connected, the tools
grouped by kind, and a Connect button. Connectors are available to both the bots
and the main chat.

Some apps have no Composio-managed sign-in (Spotify). For those, Connect asks for
the person's own developer app: client ID, client secret, and optional scopes. The
secret is kept encrypted on this device and sent only with the connect request.
See `15-search-marketplace-crm.md`, *Apps that need the person's own developer app*.

---

## Services and integrations

**Services** are third-party tools for the chat and the bots. Configure them in
Settings → Services. Their routes are in `backend/src/routes/services.ts`.

| Service | What it provides | Licence |
|---|---|---|
| OpenSEO | Domain overview and keyword research (over MCP) | MIT |
| VoiceStudio | Speech, and voice cloning with the speaker's permission | AGPL-3.0 |
| Twenty | CRM: search and create records | AGPL-3.0 (some files are marked Enterprise) |
| Postiz | Social channels and drafts. Drafts only: nothing is published or scheduled. | AGPL-3.0 |

Voice cloning requires a `permission=granted` field. The server returns 403
without it.

**Integration catalogue** (`lib/integrations/registry.ts`, `backend/src/routes/integrations.ts`).
Read-and-search connections to `files`, `drive`, `gmail`, `gcal`, `github`,
`notion` and `slack`. The caller sends the credentials with each request in the
`x-re-integrations` header.

**Context7** (`backend/src/routes/context7.ts`). Documentation search that works
with no setup. An optional key can be added.

**MCP** (`lib/mcp/`, `content/mcp-catalog.json`). An open catalogue of
Model Context Protocol servers. The catalogue loads only when its panel opens.
Entries with a verified run command install in one click. The rest link out.

**Search** (`routes/search.ts`, `services/search/`, `lib/search/`). The ladder is
described in [backend](04-backend.md#search-ladder).

---

## Skills, personas and ECC roles

**Skills** (`lib/skills/`, `backend/src/routes/skills.ts`). A skill is a prompt
template with parameters. Built-in skills come from code. Community skill packs
are in `content/skills/upstream/`, 46 of them at the time of writing. Importing a
skill runs a security scan first (`lib/security/trojan.ts`).

**Personas** (`content/personas/`, 24 files). A persona is a system prompt that
you choose per chat.

**ECC roles** (`lib/ecc/roles.ts`, `content/ecc/agents.ts`). ECC, from
[affaan-m/ecc](https://github.com/affaan-m/ecc) under the MIT licence, supplies 71
agent roles. You do not pick one of those. You pick a family with a plain name,
and the system chooses members from the request and your custom instructions. The
family descriptions below are the code's own.

| Family | Blurb in the code |
|---|---|
| Researcher | Finds, reads and checks sources before it answers. |
| Workflow | Plans the steps, keeps the work moving, and hands it on. |
| Builder | Designs and writes code, and clears build failures. |
| Reviewer | Checks code, tests, types and interfaces for problems. |
| Guardian | Looks at security, safety, health data and network risk. |
| Writer | Writes and improves docs, copy, comments and search-friendly pages. |
| Analyst | Judges results, data quality and model behaviour. |
| Maintainer | Looks after open-source projects: forks, packaging and clean-up. |

Members are chosen per request by `selectMembers`, and at most two are used per
reply (`MAX_ROLES_PER_REPLY`). A bot stores its family id. Older bots that stored a
single ECC agent id still resolve to their family (`familyForRole`).

---

## Calendar

Your own events, plus any calendar you bring in. A Google Calendar can be added by
its secret iCal address, which needs no Google login. `backend/src/routes/calendar.ts`
fetches that address.

---

## Wallet and activity

`components/activity/ActivityTracker.tsx` counts the time the app is open and in
front of you, and renders nothing. When the loyalty threshold is reached,
`components/wallet/WalletWatcher.tsx` awards a card and plays a short cutscene
once. Rewards are kept on the device. The wallet UI is in `components/wallet/`.

---

## Privacy Shield, lock and vault

Covered in [security and privacy](09-security-and-privacy.md).

---

## Settings

`components/settings/` holds one file per tab. The settings sheet opens as an
overlay from anywhere, and `/settings` is the full page. The About tab carries the
credits and licences for the open-source work this app uses.

---

## Updates

The app checks for the newest release and shows an `Alert` when one is available.
Installing goes through the server updater. See
[backend: updates](04-backend.md#updates). The modal is
`components/updates/UpdateModal.tsx`.

---

## Feedback

`/feedback` saves to the local database (the `feedback` table on the server).

---

## Hidden screens

`/secrets` and the starfield effect are easter eggs, and the code is in
`components/easter/`. They are documented here so nobody mistakes them for dead
code.
