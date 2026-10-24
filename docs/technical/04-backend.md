# 4. Backend

The backend is a single Node process built on **Hono**. It serves the `/api`
routes, the built frontend, and the streaming relay for model providers. It
holds very little state: most of the product's data is in the browser (see
[data and persistence](08-data-and-persistence.md)).

Source: `backend/src/`. Entry: `backend/src/index.ts`. Launcher:
`backend/bin/research-engine.mjs`.

## Running it

| Command | What happens |
|---|---|
| `npm start` (root) | `node backend/bin/research-engine.mjs serve --port 3847` |
| `npm run dev` (root) | Backend under `tsx watch` on 8787, and Vite on 5173, proxying `/api` |
| `npm run build` (root) | Builds the frontend, then bundles the backend with esbuild into `backend/dist/index.js` |
| `research-engine serve …` | The CLI. It uses `dist/` when present, otherwise `tsx` on `src/`. |

The launcher chooses the first runnable form:

1. `backend/dist/index.js` (the bundle),
2. `server/index.js` (a packaged tree),
3. `tsx src/index.ts` (a development tree).

The esbuild bundle uses `--packages=external`, so dependencies are installed
alongside it, not inlined.

### CLI flags

| Flag | Default | Meaning |
|---|---|---|
| `--port <n>` | `3847` (built), `8787` (source) | HTTP port. If busy, the next free port is picked and remembered. |
| `--host <addr>` | `127.0.0.1` | Bind address. Use `0.0.0.0` only on a trusted network or in a container. |
| `--data-dir <path>` | `~/.research-engine` | Where the database, media and caches live |
| `--profile <id>` | `balanced` | `eco`, `balanced` or `performance` (see below) |
| `--frontend-dist <path>` | auto | Folder holding the built UI |

### Environment variables

Precedence is **CLI flag > environment variable > `config.json` > default**.
Provider keys are *not* read from the environment. They come from the browser on
each request.

| Variable | Used by | Purpose |
|---|---|---|
| `RE_PORT`, `PORT` | runtime | Preferred port when no flag is given |
| `RE_HOST` | runtime | Bind address |
| `RESEARCH_ENGINE_DATA_DIR` | runtime | Data directory (primary) |
| `RE_PROFILE` | runtime | Resource profile |
| `FRONTEND_DIST` | runtime | Built UI folder |
| `DB_PATH` | runtime, `db/index.ts` | Database file. Set by the runtime to `<data-dir>/db.sqlite`. |
| `RE_DATA_DIR` | `routes/personas.ts`, `routes/skills.ts` | A second data-dir variable read directly by two routes. See [known issues](14-known-issues.md#data). |
| `SEARCH_BACKEND` | `routes/search.ts` | Default search engine (`auto`, `searxng`, `brave`, `serper`, `tavily`, `ddg`, `demo`) |
| `SEARXNG_URL` | search, bots web | Your SearXNG instance |
| `BRAVE_API_KEY`, `SERPER_API_KEY`, `TAVILY_API_KEY` | search | Optional search keys, for a self-hosted server |
| `OLLAMA_URL` | Ollama routes | Local model server |
| `WHISPER_URL` | `routes/voice.ts` | A local Whisper-compatible speech server |
| `VIRUSTOTAL_API_KEY` | `services/virustotal.ts` | Download checks for the coding agent |
| `TYPESAFE_API_KEY` | Jev routes | Key for the Jev decision model |
| `SKILLSPECTOR_BIN`, `SKILLSPECTOR_VENV` | skill scanning | The optional skill security scanner |
| `STRIX_BIN`, `STRIX_LLM`, `LLM_API_KEY` | Strix routes | The optional penetration-test tool and its model |
| `RE_UPDATE_REPO`, `RE_UPDATE_TOKEN`, `RE_UPDATE_MANIFEST`, `RE_UPDATE_ATTEMPTS` | updater | Update source, token, a manifest URL, and resume attempts |
| `RE_SHELL` | `build-info.ts` | Set to `desktop` by the Tauri shell to mark the sidecar |

`.env.example` at the root documents a subset of these. Its `PORT=8787` is
a development value. Setting `PORT` in a real install moves the built server
off its default port. See [known issues](14-known-issues.md#data).

### Data directory

```text
<data-dir>/
├── db.sqlite        SQLite database (or the in-memory fallback, see below)
├── config.json      Remembered port, profile and flags
├── media/           Uploaded images and exports
├── notebooks/       Document pipeline working files
├── cache/           Search and generation cache
├── connectors/      Local connector data (Drive, Mail, Calendar, Files)
├── projects/        Coding projects
├── worktrees/       Private copies for parallel agents
├── files/           Filesystem nodes used by Workflows (sandboxed)
└── keys.enc         Reserved for encrypted key material
```

The updater never writes here. Its guard refuses any path inside the data
directory (see [updates](#updates)).

## Profiles

The profile sets how much runs at once. It does not change the quality of an
answer.

| Profile | Flood workers | Search results | Concurrent streams | Background indexing |
|---|---|---|---|---|
| `eco` | 1 | 5 | 1 | off |
| `balanced` | 2 | 7 | 2 | on |
| `performance` | 4 | 9 | 4 | on |

The same table is mirrored in `frontend/src/lib/system/performance.ts`, so the
single-process server and the dev server agree. `eco` is aimed at machines with
8 GB of RAM or less.

## The app object

`index.ts` builds one Hono app:

1. **Middleware.** `cors()` for all origins (the server binds to loopback by
   default), and a `logger` that prints method and path only. Request bodies are
   never logged.
2. **Routes.** About 40 modules are mounted under `/api` or a sub-prefix. The
   full list with methods is in [reference/api-routes.md](reference/api-routes.md).
3. **Error handler.** `app.onError` returns `{ error }` with status 500. The
   message is shown to the user verbatim, so route code must not put secrets in
   error text. `maskSecrets()` in `routes/secrets.ts` redacts known key formats.
4. **JSON guarantee.** Every unknown `/api/*` path answers JSON 404 with
   `code: "no_such_route"` and the version of the server and the frontend. This
   stops a stale server from returning `index.html` with status 200, which the
   UI then fails to parse.
5. **Static files.** When a frontend build exists, `staticHandler` serves it,
   with the SPA fallback for everything else.

## Route modules

Each module is one API area. The pattern is the same everywhere: a Hono
instance, a few handlers that parse input and call a service, and a JSON reply.
Some representative modules:

| Module | Responsibility |
|---|---|
| `chat.ts` | `POST /api/chat`: the streaming relay to a provider, with dialect translation |
| `providers.ts` | Model discovery and connection tests, proxied because of CORS |
| `search.ts` | Web search through the configured ladder |
| `library.ts` | Library search across Wikipedia, the web and the user's own documents |
| `proxy.ts` | `GET /api/proxy?url=`: serves pages so the viewer can frame them |
| `services.ts` | OpenSEO, VoiceStudio, Twenty and Postiz routes |
| `composio.ts` | Composio status, apps, accounts, connect link, tool execution |
| `integrations.ts` | Integration catalogue, fan-out search and read |
| `context7.ts` | Documentation search |
| `ide.ts` | Coding mode: projects, files, git, the guarded command runner, agent access |
| `preview.ts`, `artifacts.ts` | Live preview of a project; artifacts from chat |
| `botweb.ts` | Web search and page reading for bots |
| `update.ts` | Update status, check, install, restart, rollback |
| `data.ts` | `POST /api/data/wipe`, the only destructive route |
| `health.ts` | `GET /api/health`: liveness and build fingerprint |

### The chat relay

`POST /api/chat` takes the app's common wire format and converts it to the
dialect of the provider:

- `kind: 'openai'` (default): the OpenAI chat-completions shape. Most providers
  use it, including Groq, DeepSeek, OpenRouter, Mistral and local servers.
- `kind: 'anthropic'`: the Messages API, with its own tool and thinking blocks.
- `kind: 'gemini'`: the Gemini `generateContent` shape.
- `kind: 'nim'` or an `api.nvidia.com` base URL: the OpenAI-style request, sent
  with NVIDIA's client user-agent, because their gateway rejects other agents with
  a 403. The code comment in `routes/chat.ts` records the reason.

The upstream SSE bytes are passed through unchanged, so the frontend parser is
the one place that interprets them. The request carries the key and the model;
`effort` (one of six steps) is mapped to each dialect's own vocabulary.

### Search ladder

`services/search/adapters.ts` tries engines in order and says which one answered:
the user's own engine if configured, then a keyless SearXNG (yours or a public
instance), then keyless DuckDuckGo, then a demo answer. Keys the user pasted in
Settings travel with the request and are not stored.

### Coding runner

`routes/ide.ts` is the only route that executes commands on the machine. Its
rules, from the file header: a denylist of commands that are never allowed, a
confirm-required list that the UI must approve, a working directory confined to
the project, a scrubbed environment, timeouts, and output caps. Access to files
beyond the project is set by the agent-access mode (see
[security](09-security-and-privacy.md#agent-access)).

## Persistence

`backend/src/db/index.ts` picks one of three engines at startup, in this order:

1. **`better-sqlite3`**, if installed (optional dependency, native build),
2. **`node:sqlite`**, built into Node 22.5+ and 20.19+, with no native module,
3. **in-memory**, so the server still runs everywhere else.

Journal mode is WAL when SQLite is available. The schema is created with
`CREATE TABLE IF NOT EXISTS` on boot. There is no migration framework.

> **Important:** the in-memory engine loses everything on restart. The
> `/api/health` response reports which engine is active. Check it before
> trusting the server with data.

The tables and what writes them are listed in
[data and persistence](08-data-and-persistence.md#the-server-database). The
`schema.ts` file holds Drizzle table definitions used for types. Runtime uses
raw SQL from the `MIGRATION` string in `db/index.ts`. **When you change a table,
change both.**

## Updates

The updater is the most safety-critical code on the server. Its design rules
are in `backend/src/update/service.ts`, and these are the parts that matter:

1. **It can replace the program, never the library.** Every path it touches
   goes through `guard()`, which refuses anything outside the app root and
   anything inside the data directory.
2. **A new version is on trial until it has served pages.** The files are
   swapped by rename and the previous files are kept. A marker file records the
   change. The new version is marked healthy only after it has served for
   `HEALTHY_AFTER_MS` (20 seconds). Until then, a crash or a repeated failed boot
   restores the old files.
3. **Downloads are verified** against `SHA256SUMS` from the same release tag,
   before anything moves. This protects against corruption and substitution. It
   is not a signature, and the documentation says so.
4. **A backup is taken first** (`update/backup.ts`).

The sequence is: check → download → verify → back up → unpack → swap and write
the marker → restart with exit code `75` (`EXIT_RESTART`) → on boot, count the
attempt → serve → mark healthy, or roll back. The frontend drives this through
`/api/update/*`; the UI is described in [frontend](05-frontend.md).

## Coding preview

`preview/manager.ts` starts the dev server a project needs. It detects Vite,
Next, Astro, CRA, a generic npm script, Django, or a static folder. It owns the
child process, reports its state to the IDE, and proxies the port to the browser.
`preview/bridge.ts` is a script injected into every HTML page served by a
preview. It lets the AI and the user inspect and operate the page. The Design
mode uses it to take screenshots and run audits.

`preview/worktree.ts` gives each parallel agent its own working copy, so two
agents never write the same bytes.

## Observability

- `GET /api/health` returns liveness, the build fingerprint, the database engine
  and the data directory size.
- `GET /api/resources` and `system-metrics.ts` report process memory and CPU for
  the Performance panel.
- Logs go to stdout with the `[re]` prefix. They never contain request bodies or
  keys.

## Extending the backend

The short version is in [contributing](13-contributing.md#adding-things). In
short: create `routes/<area>.ts` exporting a Hono instance, add a service in
`services/` if the logic is more than a few lines, and mount it in `index.ts`
**after** `resolveRuntime`. Then regenerate the API reference.
