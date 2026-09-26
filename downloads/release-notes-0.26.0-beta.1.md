# Research Engine 0.26.0-beta.1 — FreeRoute, six more providers, smooth text, and tasks that pin

## FreeRoute — one route to the AI that costs nothing

FreeRoute is an OpenAI-compatible endpoint in front of every free tier the app knows about:

| Route | What is free |
|---|---|
| **Z.ai · GLM Flash** | GLM-4.7-Flash / 4.5-Flash / 4.6V-Flash are free on the API |
| **OpenCode Zen** | the free publicity models (`nemotron-3-ultra-free`, `big-pickle`, `mimo-v2.5-free`…) |
| **Groq** | the free developer tier — very fast open models |
| **Google AI Studio** | Gemini's free tier, reached through the OpenAI-compatible surface |
| **Mistral** | the free experimentation tier |
| **Cerebras** | free developer tier |
| **GitHub Models** | free with a GitHub token |
| **OpenRouter** | **only** the `:free` model ids, so the route can never spend money |
| **Ollama / LM Studio** | the models on your own machine — free forever, because they never leave it |

Requests walk **your** order and fail over: a 429 from one free tier becomes the next route's problem, so a rate limit is a detour rather than an error. A wrong key stops immediately instead of trying every route; a route that only carries free ids filters paid models out; route ids are matched against a closed list, so nothing can turn a request into an arbitrary URL.

**Settings → FreeRoute** is the console: probe every route (latency, what each one actually offers for free right now), test one with a real one-token generation, drag the failover order, disable what you do not want. Your keys stay in this machine's vault and travel with the request only — nothing is stored server-side, and no prompt passes through anyone else.

The endpoint is real and you can point other tools at it:

```
http://127.0.0.1:8787/api/freeroute/v1
```

## Six more providers

**Inception Mercury** (`api.inceptionlabs.ai/v1`), **xAI Grok** (`api.x.ai/v1`), **DeepSeek** (`api.deepseek.com/v1`), **Moonshot Kimi** (`api.moonshot.ai/v1`), **Z.ai GLM** (`api.z.ai/api/paas/v4`) and **MiniMax** (`api.minimax.io/v1`). All OpenAI-compatible, all key-gated, each auto-discovering its own model list through the same proxy as every other provider.

## The libraries you asked for, on this app's tokens

- **Animated Number (Skiper UI / Number Flow)** — the focus timer now rolls its digits. The stutter and double-second are fixed **at the source**: the countdown re-anchors to the next wall-clock second instead of sampling on a 500 ms interval, so a slow frame or a throttled tab cannot accumulate drift, and the store is only written when the second actually changes. A hidden tab re-syncs on return.
- **Smooth caret input (Skiper UI)** — text fields hide the native caret and spring an animated bar to the cursor. Position is measured from the field's own computed font (so it stays glued to the glyphs), it follows selection, input, scroll and resize, hides while text is selected, and snaps under reduce-motion. **On by default**, toggleable in Appearance → Smooth caret.
- **Expandable Profile Card (Watermelon UI)** — your profile is a card you can read (avatar, name, handle, bio, **hobbies**, facts) that expands for the long version. The same card introduces the maker on About. Hobbies are real profile data now, with an editor.
- **Shuffled Pinned List (Watermelon UI)** — a task list in the top bar, shared by Research and Coding. **Pinning is how you say "this one first"**: pinned rows take the top with a layout animation, drag to reorder, shuffle the unpinned tail without ever moving a pinned item, and **Send to AI** hands the pinned tasks to whichever composer is open — pinned first, in order.
- **Select (Watermelon UI)** — a real listbox instead of a native `<select>`: keyboard-navigable, theme-true, staggered menu, and it scrolls *its own* list rather than dragging the page with it. Replaces the native selects in the quiz, compare, and library.
- **Dock (Cult UI)** — the collapsed sidebar's rail gained a glass shelf and a short reflection under the icon you are pointing at.

## Installing

**Desktop installers** (Tauri 2 — no Node, no Electron, no browser needed) and **portable builds** (Node 20+):

| Platform | File | sha256 |
|---|---|---|
| Windows 10/11 x64 | `Research.Engine_0.26.0-beta.1_x64-setup.exe` | `67b02c8a…` (38.0 MB) |
| Linux x64 | `Research.Engine_0.26.0-beta.1_amd64.deb` / `…AppImage` | `0bb418a9…` (46.5 MB) / `2ed48afa…` (121.5 MB) |
| Portable (needs Node) | `research-engine-0.26.0-beta.1-win-x64.zip` | `0b9c8531…49ef8` |
| Portable (needs Node) | `research-engine-0.26.0-beta.1-linux-x64.tar.gz` | `307c0e2d…b689f` |

Verify the portable archives with `sha256sum -c SHA256SUMS`. The desktop installers are built on the CI runner, which also boots the compiled server and checks the installer's magic bytes, NSIS signature and size before publishing.

## Verification for this round

`render-check 477/0 · smoke 65/0 · ui-test 60/0 · sample-test 33/0 · design-test 32/0 · engine/workflow/bg-props PASSED · desktop-check 46/0 (--run: healthy server, served page, persistent SQLite) · tsc clean · FreeRoute live-tested via curl (catalog + probe + error paths)`

Not tested here: real generations through the new routes — that needs API keys this build environment does not have. The probe and test buttons in Settings → FreeRoute are exactly for that, on your machine, with your keys.
