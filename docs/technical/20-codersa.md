# 20 — Codersa

Codersa is the agent page of the Coding section. It is the browser side of the
[agent harness](19-agent-harness.md): sessions, a conversation that streams as the
agent works, tool cards for every command and file action, and the controls that
decide what the agent may do.

Open it from **Coding → Codersa** (route `#/code/codersa`). The Projects view and
Codersa are two sections of the same page; the tabs switch between them.

## What the page does

- **A session rail** lists sessions grouped Today, Yesterday and Earlier, with the
  project each one works in. Search looks through every session's text.
- **The conversation** streams as the agent acts: assistant text, then one card per
  tool call. A card shows the status (running, done, or refused), the command or
  file in one line, and the output when opened. Long output is clipped in the view;
  the full text stays in the session log.
- **Fork from here** on any assistant message starts a new session from that point.
- **Stop** ends a running turn. The server stops the model call and any command, and
  the log records that the turn stopped.
- **The composer** takes a profile (Minimal or Standard) and a project for a new
  session. Once a session exists those are fixed for it, because the log records them.
- **Run commands** is a switch in the composer. It is off each time the page opens.
  While it is off, the agent can read and edit files but a shell request is refused,
  and the refusal card says how to allow it. While it is on, commands run only in the
  project folder, with a time limit, under the same access check the IDE uses.

## The model

Codersa uses the default model from the top bar and its provider's base URL and key,
so it needs no separate setup. The harness speaks the OpenAI chat-completions
protocol, so only providers of kind `openai` or `compatible` can run a turn. For any
other provider the page says why and points to Settings → Providers. The key is
decrypted only when a message is sent, and it is sent with that one request.

## The mascot

Codersa's mascot is a rounded code window with a `>_` prompt for a face, a pair of
braces for arms, and a four-point star that twinkles. It is an SVG, so it stays
sharp at any size. Its state follows the agent:

| State | Look |
|---|---|
| idle | `>_` prompt, a small smile, slow bob and blink |
| busy | quicker bob, a blinking cursor in the face, faster star |
| done | a happy arc, the star pops once |
| error | crossed eyes, no bob |

The motion is transform and opacity only, and it stops for users who ask for
reduced motion.

## Performance and memory

- The page holds at most 400 thread items. An older session opens at its newest 400
  and says how many earlier items are in the log.
- Tool output is clipped to 12,000 characters in the view.
- Each thread item skips layout and paint while off screen (`content-visibility`).
- Live events are folded into the thread without mutating the old array, so only
  changed items re-render. Assistant messages are memoised.
- Leaving the page aborts a running turn, which closes the stream and stops the
  server's model call and command. Nothing keeps running in the background.
- The session list reads each log's first line and streams the rest for a count,
  instead of parsing every log in full. Its memory does not grow with log size.
- Search is debounced, and a stale answer never overwrites a newer one.

## Code

| File | What it is |
|---|---|
| `frontend/src/components/codersa/CodersaPage.tsx` | The page: header, empty state, banners, layout |
| `frontend/src/components/codersa/useCodersa.ts` | State: sessions, the open thread, the running turn, and cleanup |
| `frontend/src/components/codersa/Thread.tsx` | The conversation, tool cards, outcome line |
| `frontend/src/components/codersa/Composer.tsx` | The message box, profile and project pickers, Run commands |
| `frontend/src/components/codersa/SessionRail.tsx` | Sessions, grouping, search, delete |
| `frontend/src/components/codersa/CodersaMascot.tsx` | The mascot and its states |
| `frontend/src/components/codersa/CodingTabs.tsx` | Projects / Codersa switch |
| `frontend/src/lib/codersa/sse.ts` | Reads the turn stream: bounded buffer, abort-aware |
| `frontend/src/lib/codersa/timeline.ts` | Builds the thread from the log or from live events; pairs calls with results |
| `frontend/src/lib/codersa/model.ts` | Picks the model and key from settings |
| `frontend/src/lib/codersa/api.ts` | The harness routes, called relatively |

## Tests

- `npm run codersa-test --workspace frontend`: the stream reader (split chunks, CRLF,
  abort, overlong lines), live and reloaded threads pairing calls with results,
  refusals, bounded threads, and output clipping.
- `npm run harness-test --workspace backend`: includes the session list summary
  (project, event count, last update) and the list's ordering.

A browser run against a stand-in OpenAI-compatible model covered: a file read, a
refused command and its explanation, an approved command, a stop mid-turn, the
project in the rail, and search.
