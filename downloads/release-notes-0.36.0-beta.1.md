# Research Engine 0.36.0-beta.1

**The search answers, the text leaves, and five shadcn-space blocks with a job each.**

This round came from two pictures and five names. The pictures were a search
screen that showed nothing after "javascript", and a feedback field whose typed
text sat on top of its own exit animation. The names were
`@shadcn-space/animated-list-02`, `badge-13`, `button-28`, `button-group-12` and
`button-group-10`, each with a job attached.

## The Library search was silent, not slow

The request could fail — or answer with nothing but a reason — and the screen
stayed blank. The failure path never recorded which query it had run, and the
empty state was gated behind that record, so a failed search rendered no
results, no reason and no way back. That is exactly what "I type and nothing
happens" looked like.

The server now answers inside a **200 ms budget**, always:

- your own documents and everything you have saved are matched locally and are
  always in the reply;
- Wikipedia and the search ladder keep running as **lanes**, and the reply names
  every lane with its state, its count and its time;
- whatever was not ready in the budget comes back as `pending`, the work keeps
  running on the server, and one follow-up call collects it — so the first paint
  is never blocked by the slowest source;
- a lane that fails carries a sentence a person can act on, not a shrug:

  ```
  Wikipedia could not resolve its host (en.wikipedia.org) — this machine looks offline to it
  DuckDuckGo answered HTTP 429
  your SearXNG instance refused the connection
  ```

On the screen: the answer time is printed beside the results, each lane shows
`ok · n results · 142 ms`, `still looking…` or its reason, a request that never
reached the server gets its own card naming the endpoint and the browser's
reason, and every empty result keeps its reasons and a **Search again** button.
Typing searches too, debounced; Enter just skips the wait. Recommendations were
given the same treatment: the server says which feed or tag it could not reach,
and there is a retry next to it.

## The vanish input no longer shows the text it is vanishing

The component asked for transparent text with a class, and the inline `color` it
also carries always wins — so the glyphs stayed visible on top of their own
scattering pixels, red spellcheck squiggles included. The colour is set inline
now, the caret hides with it, and spellcheck is off for the length of the
animation.

## Five shadcn-space blocks, each doing the job it was picked for

The registry is wired into `components.json` as `@shadcn-space`, so
`npx shadcn@latest add @shadcn-space/<name>` is the normal install. The five
files and the five primitives they need are vendored from the project's own MIT
checkout, with a digest manifest and
`node frontend/scripts/shadcnspace-vendor.mjs --verify` to prove they still
match; one block carries a documented local adaptation and the script says so
out loud. `@base-ui/react` — the flavour those primitives use — is a dependency.

| Block | Where it lives | What it does |
|---|---|---|
| `animated-list-02` | the reader and quiz loading screen | animates the pipeline's **own** stages (parsing, extracting, analysing) with the true percentage still underneath, so it cannot invent work that is not happening |
| `badge-13` | the quiz | the live streak, with NumberFlow rolling the number over inside the thump the quiz already had; a streak of zero keeps a quiet label |
| `button-28` | Settings → Data | the one irreversible action in the app: **hold** to erase everything, charging for 1.5 s, releasing the moment you do, with "export a backup first" still one click away |
| `button-group-12` | the coding toolbar | run/save as one control — the primary button runs the project, the chevron holds save, save-then-run, the terminal and the preview link, with the block's own staggered menu |
| `button-group-10` | the article editor | a new **Formatted** block: bold, italic, underline, links and lists over an editable surface the editor owns |

The formatted block is filtered through an allow-list on the way in and on the
way out: a `javascript:` link loses its href, a pasted `<script>` is dropped, and
`rel="noreferrer noopener"` is put on real links. It exports to markdown like
every other block, and the editable surface is seeded exactly once so the caret
never jumps mid-sentence.

## Verification

| Suite | Result |
|---|---|
| render-check | 857 / 0 |
| ui-test | 60 / 0 |
| r17-test | 107 / 0 |
| r17-ui-test | 31 / 0 |
| **r18-test** (new: the search contract, the vendoring, the wiring) | 60 / 0 |
| **r18-ui-test** (new: the search paths, the exit animation, the five blocks mounted) | 37 / 0 |
| ui-lab | 44 / 0 |
| fork | 32 / 0 |
| updates-ui | 17 / 0 |
| update-test (boots a real packaged install) | 81 / 0, 2 skipped (no network) |
| design-test | 32 / 0 |
| smoke | 65 / 0 |
| desktop-check | 32 / 1 (the local sidecar binary is built by CI) |

The live check inside `r18-test` measures the budget from outside the process:
against a backend on `127.0.0.1:8787`, `GET /api/library/search?q=javascript`
answers with its lanes and its own `tookMs`, and every failed lane carries a
reason of more than eight characters.

## Installers

Windows gets a per-user `setup.exe` (no Node, no Electron, WebView2 fetched
automatically); Linux gets a `.deb` and an `.AppImage`. There is no macOS build —
there is no macOS runner, and no macOS artifact is promised here. CI builds them
from this tag; their hashes are recorded in `downloads/INSTALLERS.sha256` as
GitHub's own digests for the uploaded assets, read back from the release API.

Both portable archives in `downloads/` report `0.36.0-beta.1` from
`/api/health`, and `downloads/SHA256SUMS` carries their hashes.
