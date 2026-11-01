# 16 — AI council, local models, generated media, and Advanced settings

This page covers four additions that sit in the chat and Settings: the **AI
council**, **local models** downloaded through Ollama, **generated images and
audio** from tool calls, and the **Advanced** section that holds the Composio
endpoint. It also records the Settings restructure that moved MCP servers into
Marketplace.

## 1. AI council

Several models answer the same conversation. The model you chose writes one
answer that weighs their drafts.

| Piece | File |
|---|---|
| Members, the drafting call, the block for the chair | `frontend/src/lib/chat/council.ts` |
| The stage inside the chat loop (runs once, before tools) | `frontend/src/lib/chat/runChat.ts` (the `mode.council` block) |
| Composer pill "Council" | `frontend/src/components/input/InputBar.tsx` |
| Members picker (up to four) | `frontend/src/components/settings/CouncilPanel.tsx` |
| Collapsed drafts under the answer | `frontend/src/components/chat/CouncilMedia.tsx` |

How it works:

1. Turn on **Council** for a message in the composer. It is a mode, like Quality or Math.
2. Each member (from **Settings → Models → AI council**, up to four) gets the same
   messages, its own provider key and endpoint, and answers in plain text. Members
   run in parallel and do not use tools.
3. Their drafts are clipped to 6,000 characters each and added to the chair's system
   prompt, after shielding. The chair checks them, keeps what is right, and says where
   they disagreed.
4. The drafts are saved on the message (`ChatMessage.council`) and shown as a collapsed
   "AI council" block, so the final answer stays the focus.

Cost: each member is a separate billed request, and the chair's answer costs one
more. Member tokens are added to the message's usage totals, so the cost shows.
Council is for hard questions. If Council is on with no members chosen, the message
says so instead of failing.

## 2. Local models

Run a model on this machine through Ollama, with downloads from Hugging Face.

| Piece | File |
|---|---|
| Hugging Face search, pull, delete (server) | `backend/src/routes/ollama.ts` |
| Fit estimate and recommendation | `frontend/src/lib/local-models/fit.ts` |
| Device detection and budget | `frontend/src/lib/local-models/hardware.ts` |
| Browser client: search, streamed pull, list, delete | `frontend/src/lib/local-models/client.ts` |
| The panel (Settings → Models, top section) | `frontend/src/components/settings/LocalModelsPanel.tsx` |
| Entry from the model picker | `frontend/src/components/topbar/ModelPicker.tsx` ("Download a local model…") |

**Categories.** Official (published by the lab that made the model), Abliterated
(community variants with refusals removed, shown with a caution), and Optimized
(quantised re-uploads by people who make local models fast and small). The author
lists are a starting point, held in `LOCAL_CATEGORIES`, and can be changed there.

**Search runs on the server.** The browser asks `GET /api/ollama/hf-search`, and the
server queries Hugging Face. This keeps the browser free of Hugging Face's CORS rules
and lets the server limit what it asks for.

**Download.** A model is pulled as `hf.co/<owner>/<repo>:<quant>` through
`POST /api/ollama/pull`. The server checks the name, then passes Ollama's NDJSON
progress stream through unchanged, so the browser can draw a progress bar. After a
successful pull the app adds Ollama to the providers and refreshes its model list, so
the model shows in the picker.

**Device fit.** A browser cannot read GPU memory, so the detected numbers are a floor.
The budget for one model is:

- with video memory entered: 85% of it;
- otherwise: half of system memory (browsers report at most 8 GB, so the panel asks the
  person to enter their real RAM).

A GGUF's size is estimated as parameters × bytes per parameter for the quantisation,
plus 1.2 GB for context and runtime. A model fits comfortably below 75% of the budget,
is tight up to 100%, and is too heavy above that. The recommendation is the largest
model that fits comfortably. On a 4 GB laptop this points at roughly 1B–3B models.
These are estimates, not benchmarks. canirun.ai is linked for a second opinion; the
sandbox used to build this could not reach it, so no data was taken from it.

**Requires Ollama.** If Ollama is not running, the panel says so and offers a check
again. Nothing is downloaded without it.

## 3. Generated images and audio

The model can make an image or a spoken clip when a person asks for one. Both are
tools in `frontend/src/lib/chat/media-tools.ts`, and their results appear under the
answer (`ChatMessage.media`, rendered by `MediaStrip`).

| Tool | Offered when | Backend |
|---|---|---|
| `generate_image` | the active model can call tools and the provider has an image model | the existing image path (`lib/images/generate.ts`) |
| `generate_audio` | the model can call tools, an OpenAI key is saved, and VoiceStudio is not set up | OpenAI speech endpoint, model `gpt-4o-mini-tts` (see below) |

Rules that apply to both:

- Tools are offered only to providers that take a tool list (OpenAI, Gemini,
  Anthropic). `activeModelCanCallTools()` also withholds tools from a short list of
  known chat models that cannot take them (`o1-mini`, `o1-preview`, instruct-only
  completions). The list is deliberately short.
- The tool result sent back to the model is a short sentence. Image and audio bytes
  never go back into the conversation.
- Audio is refused above 4 MB, so the saved chat does not grow without limit.

Assumptions to check: the speech model id `gpt-4o-mini-tts` and the voice list are
OpenAI's at the time of writing. If OpenAI changes them, change `SPEECH_MODEL` and
`OPENAI_VOICES` in `media-tools.ts`. Generated images and audio are stored as data
URLs inside the chat, so a long session with many images takes more local storage.

## 4. Advanced settings and the Composio endpoint

**Advanced** is a section at the bottom of **Settings → Integrations**, next to the
Composio key. It holds one option for now: where Composio requests go.

- **Hosted API (recommended)** — `https://backend.composio.dev`. Works with the key
  you already saved. Nothing to run.
- **Self-hosted gateway** — for teams with data-residency or network-boundary rules.
  Composio's self-host is an enterprise deployment (Docker, a key store and ingress in
  your own infrastructure). The panel says so and links to Composio's page.

The endpoint is stored as `settings.composio.endpoint` and sent as `x-re-composio-base`
on each Composio request. The server validates it (`normalizeComposioBase`): https
anywhere, http only for `localhost`, `127.0.0.1` or `[::1]`, and no credentials, query
or fragment. A bad address gets a 400 before any request is made.

Per-request routing uses `AsyncLocalStorage` (`runWithComposioBase`), so the existing
call sites are unchanged. The key fingerprint used for caches includes the endpoint,
so the same key is treated separately on each server.

Tests: `backend/scripts/composio-endpoint-test.ts` (25 checks), covering the rule, the
per-request scope, the cache identity and that a refused address never reaches fetch.

## 5. Settings restructure

- **Coding & MCP** is now **Coding**. It has a real setting: **command time limit**
  (10–300 seconds, default 60), saved as `settings.coding.commandTimeoutSec`. The
  terminal and the AI's command tool send it as `timeoutMs` to `/api/ide/exec`, which
  clamps it to the same range. The safety summary stays.
- **MCP servers** moved to **Marketplace → MCP servers**
  (`frontend/src/components/marketplace/McpSection.tsx`). The Coding tab links to it.
  The MCP panel itself is unchanged; the old `McpTab` is gone.

## Tests

| Command | What it checks |
|---|---|
| `node ../node_modules/tsx/dist/cli.mjs scripts/composio-endpoint-test.ts` (in `backend`) | endpoint rule, per-request scope, route refusal |
| `node ../node_modules/tsx/dist/cli.mjs scripts/ollama-local-test.ts` (in `backend`) | pull and delete name checks, NDJSON passthrough, Hugging Face mapping |
| `npm run local-council-test --workspace frontend` | fit and budget arithmetic, recommendation, split NDJSON parsing, council caps and block, endpoint rule |

Not verified here: a real Ollama pull, a real Hugging Face search from a user's
network, and a live OpenAI speech call. The sandbox cannot reach those hosts. The
server routes are tested against stand-in responses, and the browser parser is tested
on split byte streams.
