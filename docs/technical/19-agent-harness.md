# 19 — Agent harness

The harness is a backend agent runtime that follows the architecture of
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (MIT,
Copyright 2026 DeepSeek). It is built on the plugin model of
[Cordis](https://github.com/shigma/cordis) (MIT, Shigma), which DeepSeek Harness
uses as its kernel. Credit and the licence text are in
[THIRD-PARTY-NOTICES.md](../../THIRD-PARTY-NOTICES.md).

The code lives in `backend/src/harness/`. The HTTP routes are in
`backend/src/routes/harness.ts`.

> **Scope.** This is a reimplementation of the architecture, not a copy of
> DeepSeek Harness's code. It has the kernel, the plugin model, the session log,
> the minimal and standard tool sets, and the agent loop. It does **not** have
> DeepSeek's Creator mode, Code Mode SDK, the browser-use and computer-use
> packages, the scheduler, the MCP bridge, or the web UI. See "Not included".

## Parts

### 1. The kernel (`kernel.ts`)

Everything the harness does is a **plugin** that claims **services** by key.

| Concept | What it does |
|---|---|
| Service | A value under a string key: `tools`, `llm`, `sessions`, `agent`. |
| `inject` | The keys a plugin needs. It mounts only when they are all provided. |
| `ctx.provide(key, value)` | Claims a service. Two plugins cannot claim the same key at once. |
| `ctx.effect(setup)` | Runs setup now. Its disposer runs on unmount, in reverse order. |
| `ctx.on(event, fn)` | An event listener, removed on unmount. |
| `ctx.plugin(def)` | A child plugin. It unmounts with its parent. |

Two rules keep the tree honest:

- **Dependents follow providers.** If a provider unmounts, every plugin that
  injected its service goes back to *waiting*, and remounts when the service
  returns.
- **A plugin that throws on mount is removed**, and the error is recorded in
  `kernel.errors`. It is not retried, so it cannot loop.

### 2. Profiles (`profiles.ts`)

A profile is data: the tools the model is offered, and the step budget for one
turn. Every plugin is loaded once, so one session store and one model adapter
serve every profile. A profile only decides what may run.

| Profile | Tools | Steps per turn |
|---|---|---|
| `minimal` | `bash`, `str_replace_editor` | 12 |
| `standard` | `bash`, `str_replace_editor`, `list_files`, `read_file` | 25 |

A tool outside the profile is refused even if the model names it. The refusal is
written into the log as the tool's result.

### 3. Tools (`tools.ts`)

Each tool is a plugin that registers with the `tools` service. Output is clipped
to 12,000 characters, keeping the start and the end.

- **`bash`** runs only when the turn says `approve: true`. It is also checked by
  the IDE's agent-access policy (`services/agent-access.ts`), the same check
  used by the coding workspace, and it runs in the project folder with a timeout
  (30 seconds by default, 120 at most).
- **`str_replace_editor`** can `view`, `create`, and `str_replace`. A replacement
  must match exactly once.
- **`list_files`** and **`read_file`** are read-only. They hide `.git` and
  `node_modules`.

Every path is resolved and its real location is checked, following symlinks. A
path that lands outside the workspace is refused, including through a symlink
that points outside it.

### 4. The model adapter (`llm.ts`)

One OpenAI-compatible `POST {base}/chat/completions` call, with tools. The API
key arrives with each turn, is sent as a bearer token for that request, and is
never stored. Error text has the key removed before it is shown.

The transport is injectable, so the tests run with a scripted model and no
network.

### 5. Sessions (`sessions.ts`)

A session is an **append-only JSON Lines file**, one per session, in
`<data>/harness/sessions/`.

- Events are never rewritten. Each one has an index `i` and a timestamp `t`.
- **Resume** reads the log and continues from its end.
- **Fork** copies events `0..N` into a new session, so a user can branch from
  any point.
- **Search** finds text across every session and returns the event and a
  snippet.
- **Replay** reads the log in order.
- The log refuses any field whose name looks like a secret (`apiKey`, `token`,
  `password`, …). A key cannot reach the log by accident.

### 6. The agent loop (`agent.ts`)

For each turn:

1. Append the user's message.
2. Rebuild the model's messages from the log, then fit them to the context budget.
3. Call the model. If it asks for tools, run them, log each result, and repeat.
   If it answers, log the answer and finish.
4. Stop at the profile's step budget, or when the user aborts.

**Context stays bounded** (default 120,000 characters, about 30,000 tokens):

1. Tool output older than the last six messages is shortened to 400 characters.
2. If that is not enough, the oldest whole turns are dropped, and a note says so.
   Cuts happen only at a user message, so a tool call is never separated from its
   result.
3. The newest turn is always kept.

The log keeps everything. Only the window sent to the model is fitted. An
interrupted tool call is answered with "Not run: the turn was stopped", so the
next model call is valid.

## Routes

| Method and path | Purpose |
|---|---|
| `GET /api/harness/profiles` | The profiles and their tools. |
| `GET /api/harness/sessions` | Sessions, newest first. |
| `POST /api/harness/sessions` | Create `{ profile, project?, title? }`. `project` must be a folder in Coding projects. |
| `GET /api/harness/sessions/:id` | The full log. |
| `DELETE /api/harness/sessions/:id` | Delete a session. |
| `POST /api/harness/sessions/:id/fork` | Fork at event `{ at }`. |
| `GET /api/harness/search?q=` | Search every session. |
| `POST /api/harness/sessions/:id/turn` | Run one turn. Streams server-sent events. |

A turn body is `{ text, approve?, model: { base, model, key } }`. The stream
sends `start`, then `assistant`, `tool_call`, `tool_result`, and `error` events as
they happen, then `end` with the outcome (`done`, `stopped`, `error`, or
`step-limit`). If the client disconnects, the model call and any running command
are aborted.

## Tests

`npm run harness-test --workspace backend` runs 24 checks, all offline:

- **Kernel**: waiting for injected services, cascading unmount and remount,
  reverse-order effects, listener removal, a failing plugin, and conflicting
  service claims.
- **Tools**: clipping, the bash approval gate and access check, symlink escape,
  the editor's exact-match rule, and read-only file tools.
- **Model client**: bearer header, and the key kept out of errors.
- **Sessions**: append-only indexes, fork, search, and the secret-field refusal.
- **Context**: a long session fits the budget, keeps the newest turn, and keeps
  every tool call paired with its result.
- **Loop**: a tool call and its answer end to end, the key kept out of every
  file, a refused tool, the step limit, an abort, and the HTTP routes.

## Not included (and why)

- **No web UI.** The routes are ready, but there is no harness panel yet. The
  Coding workspace still uses its own agent.
- **No Creator, Code Mode, or Minimal-with-Cordis-config profiles.** Only the
  two profiles above exist.
- **No scheduler, MCP bridge, browser or computer use.** These are large
  packages in DeepSeek Harness and would be separate projects.
- **Cordis is not vendored.** The kernel is a smaller reimplementation of the
  ideas, so the repo does not gain the Cordis dependency tree.
- **Model calls are not streamed token by token.** Each model reply arrives
  whole, and tool events stream as they happen.
- **Live model behaviour is not tested.** The tests use a scripted model. A
  real provider has not been called from this sandbox.
- **Summarisation is not implemented.** Long sessions are bounded by dropping old
  turns, not by summarising them. A summary step would keep more context.
