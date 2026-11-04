# Research Engine 0.33.0-beta.1

**Eighteen more components, actually used — and the vocabulary that makes them
this app instead of a lookalike.**

You asked for the libraries to be real parts of the product rather than folders
that happen to exist. Every one of the 18 SmoothUI components
([educlopez/smoothui](https://github.com/educlopez/smoothui)) now does a job you
can see, and the reason they look like Research Engine rather than like a
shadcn demo is the part that took the longest.

---

## The vocabulary is the work

SmoothUI is written against shadcn's token names — `border-border`, `bg-muted`,
`text-muted-foreground`, `bg-card`, `ring-ring`, `text-destructive`, `bg-brand`.
None of those existed in this app, and the usual way to install them is a
light/dark pair of ramps in `.dark`. That would have been wrong here: this app
has **thirteen themes**, it switches by `:root[data-theme="…"]`, it has *two*
light palettes (Catppuccin Latte, Solarized Light), and it has exactly one
`dark:` utility in its own components because it never needed one.

So the token names are **mapped onto this app's own variables** instead:

```css
--color-border: var(--surface-border);
--color-muted: var(--elevated);
--color-muted-foreground: var(--text-2);
--color-card: var(--surface);
--color-ring: var(--primary);
--color-destructive: var(--danger);
--color-brand: var(--primary);
```

One indirection, no `.dark` island anywhere, and every SmoothUI surface follows
the palette you picked — including the light ones. The build asserts the mapping
exists and that no `.dark` block was introduced.

## Where each one lives

**Onboarding** — the clearest illustration of "actually used":

| Component | What it does there |
|---|---|
| `kinetic-center-build` | the three promises build word by word in the centre, hold, then hand over |
| `typewriter-text` | the line underneath: `local-first · bring your own key · works offline` |
| `github-stars-animation` | the repository's **real** star count, from the GitHub API — and nothing at all when offline, because an offline-first app should not invent a number |
| `mac-terminal` | the connection test, typed: the endpoint, your key reduced to four characters and an ellipsis, then the provider's own answer or refusal — replayed from scratch on every press |
| `folder-reveal` | the offline demo's four parts, fanned out of a folder under your pointer |
| `stagger-from-edges` | section labels and the closing line, one character at a time |

**In the chat**

| Component | What it does there |
|---|---|
| `ai-message` | both sides of the conversation: the app's mark beside every answer, your messages in a bubble, a timestamp, copy / thumbs / retry that fade in from the side the bubble is anchored to — in CSS, so a row can never get stuck half-revealed |
| `ai-response` | streaming words **blur in as they arrive** instead of on a fixed timer: an animation that describes the stream rather than one that lies about it |
| `ai-sources` | a collapsed index of sources above the citation cards |
| `ai-loader` | the humanize rewrite, reporting **its own elapsed seconds** so a slow rewrite says so |
| `ai-tool-call` | the tool that is running right now, as a card — not just a chip in a row |
| `ai-reasoning` | "how this answer was made", carrying the real numbers, including the wall-clock time between your prompt and the answer |
| `ai-diff` | editing one of your own messages: what is about to be removed, what replaces it, and one place to accept |
| `ai-context-meter` | a ring in the top bar for how full the open chat's context window is |
| `ai-task-list` | Agent Flood's agents as a live checklist of state — idle, working, done, halted |
| `ai-approval` | wiping your data: the destructive option is marked destructive, and the first option is a backup |
| `social-hover-card` | the maker, on hover, in About |
| `image-generation-panel` | a new **Image lab** widget on the home screen |

**Image lab** is a real feature, not a showcase: it posts to your configured
provider's `/images/generations`, using the image model out of the provider's
**own discovered list** (`dall-e…`, `gpt-image…`, `imagen…`, `flux…` —
matched, never hardcoded), with your key from the vault and a 120-second
client-side timeout. When the provider lists no image model, the card says
exactly that instead of pretending. Images are held for the session only: far
too big for local storage, and a picture you did not ask to keep is not one to
keep.

## Local patches, in the files they patch

Upstream code was not copied blind — four lines are patched, each with a comment
saying why:

1. `folder-reveal`: `items.at(-1)` → an index. `Array.prototype.at` needs
   `lib: ES2022`, and the Linux Tauri webview can lag behind. Same value,
   ES2020-safe.
2. `smooth-button`: `useRef<HTMLButtonElement>(null)` → `useRef<HTMLButtonElement | null>(null)`.
   The ref callback is called with `null` on unmount; the narrower type is a
   TypeScript error waiting to happen.
3. `ai-message`: the animation stylesheet is attached to the document **once**,
   from an effect, instead of being rendered inside every bubble — a long thread
   used to carry one copy of those rules per message.
4. `ai-message`: gained a `contentClassName` prop, so a 760px answer can opt out
   of `max-w-prose` without fighting it.

## Installed the ordinary way

`frontend/components.json` registers the real host
(`https://smoothui.dev/r/{name}.json`) and `frontend/scripts/smoothui-registry.mjs`
rebuilds a **local mirror of the whole registry** from a checkout of the upstream
repository — 237 items, the same file selection and the same import rewrites the
site's own route performs, plus the token payload generated from upstream's
`registry-tokens.ts`. That is how these were installed here: through
`shadcn add`, against the mirror, in a sandbox that cannot reach
`smoothui.dev`. On a normal machine the committed config needs no mirror at all.

## Numbers

Everything below was run on this exact tree, and the packaged build was used as
the server for the design-mode and smoke suites:

| Suite | Result |
|---|---|
| `render-check` (includes 23 new SmoothUI checks) | **823 passed, 0 failed** |
| updates UI — the popup and the tab strip, mounted for real | **17 passed, 0 failed** |
| updater suite | 81 passed, 0 failed, 2 skipped (no network for the GitHub-hosted cases) |
| models / smoke / UI / integrations | 96 · 65 · 60 · 51 — all passed |
| design mode end-to-end | **32 passed, 0 failed** — against the packaged 0.33 build |
| desktop check (`--run`, compiles and boots the real sidecar) | **44 passed, 0 failed** |
| developer bench (against the packaged build) | 8 passed, 0 failed — see `bench-report-0.33.0-beta.1.txt` |

The new render checks are there to enforce the requirement rather than describe
it: a component that is merely sitting in a folder is a **failure** — each of
the 18 must be imported by a file outside its own directory, with the token
mapping, the real registry host and the patch comments asserted too.

## Downloads

| Artifact | Platform | sha256 |
|---|---|---|
| `research-engine-0.33.0-beta.1-linux-x64.tar.gz` | any x64 Linux with Node 20+ | `387e5c27…59c27c9` |
| `research-engine-0.33.0-beta.1-win-x64.zip` | Windows 10/11 x64 with Node 20+ | `12b8c1e7…88f7da2` |

Both archives are committed at this tag, which is also the updater's first
source — so an installed 0.32.0-beta.1 can update to this version even though
the repository is not public yet.

| Installer | Platform | Size | sha256 (GitHub's own digest for the uploaded asset) |
|---|---|---|---|
| `Research.Engine_0.33.0-beta.1_x64-setup.exe` | Windows 10/11 x64, per-user, no language prompt, WebView2 fetched automatically | 38.9 MB | `890ebdf7…3b777b8` |
| `Research.Engine_0.33.0-beta.1_amd64.deb` | Debian/Ubuntu x64 | 47.4 MB | `84a2953f…a85d9f` |
| `Research.Engine_0.33.0-beta.1_amd64.AppImage` | any x64 Linux | 122.3 MB | `9d5af75b…6d93ba53` |

Built and attached by the desktop workflow on this tag (run 36327506823,
success); `downloads/INSTALLERS.sha256` carries the same three digests in
`sha256sum` form. Installers are **not bit-reproducible** — every build embeds
its own timestamp, so pushing the tag again produces different bytes with
different digests. The three above are the ones currently attached to this
release, which is the copy you download; the portable archives in
`downloads/SHA256SUMS` are committed files and never change.

There is no macOS runner in the workflow — the app builds and runs on macOS,
but nobody here can produce or verify a `.dmg`, so none is offered.

## Updating to this version

* **Installed desktop build** — Settings → Updates, or the pill in the top bar
  when a new version announces itself. Nothing downloads without your press.
* **Portable archive** — unpack over the old folder (your data lives in
  `~/.research-engine`, or `%USERPROFILE%\.research-engine`, and is untouched).
* **From a checkout** — `git pull && npm install && npm run build`.

---

*Research Engine is built by [dnishh](https://github.com/timetorepo/researchengine).
MIT. No accounts, no telemetry, no server that holds your work.*
