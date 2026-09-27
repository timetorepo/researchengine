# Research Engine 0.30.0-beta.1

Two rounds of work in one release, because they are the same story: things that
looked like features but were really obstacles — a fake provider, a search box
that returned nothing, a timer you could not set, and a repository nobody can
see yet.

## "This GitHub page isn't public — how does a user get an update?"

Fair question, and the honest answer is that until now they could not. This
release answers it three ways, all inside **Settings → Updates → Where updates
come from**:

- **A read-only token.** A fine-grained PAT with *Contents: read* on this
  repository. The backend attaches it to `api.github.com`,
  `raw.githubusercontent.com`, `github.com`, `objects.githubusercontent.com` and
  `codeload.github.com` — those hosts and no others, never a redirect target —
  and it is never logged or echoed back (the status endpoint reports
  `token: "set"` and nothing more). The moment the repository goes public you can
  delete the token and everything keeps working.
- **A manifest URL.** If you would rather not hand out a token at all, point the
  updater at any static JSON file that lists releases — a gist, an S3 bucket,
  a page on your own server. Three shapes are accepted (`[…releases]`,
  `{releases:[…]}`, or a single `{tag_name, version, notes, archive, sums}`).
  Archives and checksums are read from the manifest when it provides URLs, and
  from the release tag when it does not.
- **Install from file.** You already have the archive — a download, a USB stick,
  a mirror, a build someone sent you. Pick the `.tar.gz` / `.tgz` / `.zip`, paste
  the `SHA256SUMS` text if you have it (or let the app fetch it), and it goes
  through the same verify → unpack → swap path a network update takes. A
  checksum that does not match refuses to install; a checksum that is missing
  when one could be fetched says so instead of guessing.

The tab now ends by naming the source it is actually reading from
(`github · timetorepo/researchengine · token set`, or the manifest URL), and a
certificate failure comes with the real fix (`NODE_EXTRA_CA_CERTS`) rather than
looking like a dead network.

The rule from 0.29.0 is unchanged and still the first thing the updater does:
**the checksum is verified before a single byte is unpacked**, and your library
in `~/.research-engine` is never part of the swap.

## FreeRoute is a feature, not a provider

You were right that it never belonged in the provider list. FreeRoute is gone —
from the catalog, the model picker, its settings tab and the HTTP API — and it
now does what you described: it points a chat at a **free model on a provider you
already configured**.

Turn on *FreeRoute in chats* and a message with no model chosen goes to the best
free candidate:

- a model on **this machine** first (Ollama, LM Studio) — it costs nothing and it
  cannot rate-limit you,
- then the free models of the providers you added, in your own order,
- never a model you have not marked free, and never a provider with no key.

If the model answers `429`, `408`, `409`, a `5xx`, a rate-limit or a capacity
error, the chat moves to the next candidate — at most three deep — and keeps the
one that failed out of the rest of the conversation. The route is a setting you
can see, not a black box.

## Search that answers

A search box that returns nothing is worse than no search box.

- **No keys needed.** The backend finds SearXNG for you: your own instance if you
  run one, then `localhost:8080`, then seven public instances probed in turn.
  Whichever answered is remembered for the next few minutes so the second search
  is fast, and the last resort (DuckDuckGo, then the offline demo set) keeps the
  panel from ever coming back empty.
- **Keys, if you want better.** Brave, Serper and Tavily keys are typed in the
  search panel or in Settings — no environment file, no backend restart. They
  travel with each request as a header and are read at the moment of use, so the
  server never stores them.
- **The response says what happened:** which backend answered, what it tried
  first, and why the ones before it did not.

## Timeouts you control, per provider

Every provider card in **Settings → Providers** has a timeout in seconds
(3–600, default 45). It is the app's patience, not the provider's: it is enforced
by the client before the request is aborted. When a provider is slow on purpose —
a reasoning model, a busy free tier — you can say so instead of watching the
spinner give up.

## Dictation, and the Voice component you asked for

Three engines, and you choose:

- **In this browser** — the Web Speech API. Free, instant, words appear as you
  speak (Chrome, Edge, and the Windows desktop build; Linux WebKit has none and
  says so).
- **A provider** — records, then posts the audio to any OpenAI-compatible
  transcription endpoint you already keyed: `whisper-1`, `gpt-4o-transcribe`,
  Groq's `whisper-large-v3`.
- **A local whisper server** — whisper.cpp or faster-whisper on your own machine.
  Nothing leaves the host.

Push-to-talk is a setting; the mic pill is the React Bits Micro **Voice Pill**;
the words append to what you already typed rather than replacing it. Wispr Flow
and every other external dictation tool keep working exactly as before — dictate
into it and paste, or dictate here.

The glow along the bottom edge of the composer is **Voice by Jakub Antalik**
(`voice-glow`), wrapped around the real input element — the actual component,
imported, not a lookalike.

## The dock has an off switch

You said the model selection felt clunky with the dock. So: **Dock animation** is
now a switch in the picker's own settings row and in **Settings → Appearance**.
Off, the rows are perfectly still — no growing, no lifting neighbours, no text
moving under the pointer. The picker keeps its free/paid filter and counts, sort,
tier badges with right-click override, unlist toggle and per-family logos either
way.

## Pages that open fast

This is a Tauri app; it should feel like one.

- The bundle no longer ships two copies of the animation library.
- The settings sheet, tasks panel, command palette, shortcuts, skill builder,
  skill run, onboarding, star field and diagnostics are all loaded when they are
  first opened instead of in the first load.
- **Every route chunk is warmed two frames after the first paint** (with a
  fallback timer), instead of waiting for the browser to go idle — by the time
  you click the rail, the chunk is usually already there. Only the routes you
  actually visit still compile their own code.
- The server side matches: brotli, gzip, `ETag` and `304` for repeats, immutable
  cache headers on hashed assets and `no-cache` on the shell.

Measured on this build: the entry bundle is **1,002 kB raw / 315 kB gzip**
(down from 1,424 kB / 437 kB two releases ago), and a repeat visit to a hashed
asset is a 304 with no body at all.

## React Bits Micro, actually used

Six components from the Micro collection are vendored from source (MIT +
Commons Clause — the notice is kept, and they are not redistributed on their own)
and are doing real work in the app rather than sitting in a folder:

| Component | Where it is used |
|---|---|
| **PromptBar** | the Agent Flood objective field (models, effort, dictation) |
| **HoldButton** | the *hold to install* action in Updates |
| **RubberSegment**, **GlideSelect** | the model picker's filters and sort |
| **LatticeLoader** | the search spinner |
| **VoicePill** | the composer's microphone |

## Also in this release

- Search, voice and FreeRoute have their own settings sections instead of being
  buried in General.
- A composer that is dictating can still be typed into; the caret is where you
  left it.
- Onboarding is a fixed overlay, so it can no longer sit in the flow and push the
  shell around.
- The right-click menu still never appears over the progress bar, the progress
  bar still offers all four modes, and Share Studio still draws every style.
