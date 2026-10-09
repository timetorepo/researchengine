# Research Engine 0.35.0-beta.1

**The gooey search fixed, an app that tells you what reads as AI, skills that are
scanned before they run, and five more components each doing a job.**

The picture you sent was the chat search: a magnifier stretched into a giant
tile beside a field that was not a field. It was not the component's logic. And
the reading demo, removerAlpha, SkillSpector, skill import, the Library search,
notifications and resumable downloads are all in this build.

---

## The gooey input, actually fixed

Aceternity's component names eleven classes: `root`, `filter`, `filter-wrap`,
`button-row`, `trigger`, `open-button`, `icon`, `field`, `bubble`,
`bubble-surface`, `surface`. Not one of them had a rule in this app's
stylesheet, so every box fell back to the browser's default. An unsized inline
SVG is **300×150**, which is the magnifier that filled the card; the "field"
was a square because nothing bounded it either.

The fix is a stylesheet block written against those names, at the end of
`globals.css`, inside `@layer components` so a caller's own classes still win:

| Box | Size |
|---|---|
| the pill (`__trigger`) | 34px tall, bounded |
| the glyph (`__icon`) | 15×15, `flex: none` |
| the field (`__field`) | 100% of its pill, `min-width: 0`, ellipsis when expanded |
| the bubble (`__bubble-surface`) | 34×34 |

The filter is dropped under `prefers-reduced-motion` rather than animated. Every
class the component emits now has a rule, and `npm run r17-test` fails if a
future install adds one without one.

## removerAlpha: what reads as AI, without a token

A new screen. Paste anything — a draft, an abstract, an email from an assistant
— and it tells you *what* reads machine-written, locally:

- **around twenty-six rules** across punctuation, stock phrasing, vocabulary,
  sentence rhythm, structure, formatting and statistics;
- each firing rule shows **why it counts**, **what to write instead**, and the
  **exact spans it matched**, with a count;
- a **0–100 density score** and a band (human / light / noticeable / heavy);
- **mechanical fixes** for the things that cannot change meaning: em dashes,
  ellipses, `**bold**` markers, `furthermore/moreover/additionally` openers,
  "it is worth noting that", "in conclusion", "delve into", "leverage", "as an
  AI", and the trailing offer of more help;
- **the full list** of everything it checks, fired or not.

No model is called. There is no API call in the module, which is what makes the
full list free. A chat answer can hand its own text over with one click.

## SkillSpector: skills are scanned before they run

Importing a skill means running someone else's instructions with this app's
permissions, so the scanner stands in the doorway:

```
skillspector scan <dir> --format json --no-llm
```

That is **NVIDIA's SkillSpector** (`github.com/NVIDIA/SkillSpector`), invoked as
a process — not a reimplementation. `--no-llm` is deliberate: the tool's default
sends the skill's file contents to a model provider, and a security scan that
uploads the thing it is inspecting is the wrong default here. The static pass
(regex, Python AST, YARA) needs no key and no network.

- the binary chain follows the project's own documentation: `SKILLSPECTOR_BIN`,
  then `PATH`, then Docker;
- when the tool is missing, an **app-local static pass** runs instead and the
  verdict is labelled `local-static` with the install command — a scan by the
  real tool and a scan by ours can never be confused;
- a **DO NOT INSTALL** verdict cannot be clicked past by accident (the install
  button becomes a deliberate override);
- the report is stored **with the skill** and shown in the list from then on.

## Answers preview their links, politely

Hovering a link in an answer asks the local server, which:

1. reads the site's **`robots.txt`** first, once per host, and **refuses** what
   crawlers may not read — the card says so and the link still works;
2. reads the page's own **Open Graph / Twitter** tags;
3. only then leaves a **screenshot** to a service the *browser* loads, not the
   server;
4. falls back to a tile built from the site's **favicon** and domain.

Three fallbacks, in order, so a preview card is never blank. Private and
loopback addresses are refused outright.

## Five more components, each with the job you named

| Component | Its job |
|---|---|
| `placeholders-and-vanish-input` | **feedback** — the note scatters into pixels and is written to a local table you can read back at any time from the rail |
| `multi-step-loader` | a new **"Setting up"** onboarding step, before "You're set" |
| `following-pointer` | **design mode pointing** — your own avatar and name |
| `tooltip-card` | cards the **model calls as a tool**, not hovers on matched text |
| `link-preview` | the link cards above |

**The setting-up step is not decoration.** Behind the animation, real work runs:
the theme is applied, settings are written and read back, the local server's
health is checked, your key is verified with the provider, and the model list is
fetched. The step only offers to continue once *both halves* have finished, and
it prints what it did.

**Pointing is a gesture, not a mode.** The preview frame hides the system cursor
inside itself and reports its mouse position across (a mouse over an iframe is
invisible to the parent page, which is why this needed the bridge). Your avatar
and name follow the pointer, and the click writes what you pointed at into the
assistant's draft — selector, role, and the words on screen — as a sentence you
finish.

**The tooltip card is a tool call.** `show_tooltip_card` takes one to five cards
with a title and optional body, image, source and link, and the message renders
them as chips that open on hover. The point is the constraint: a model that
cannot call tools cannot summon a card, and nothing renders by matching text.

## The Library: one search, three lanes, folders, feeds

The gooey input is now the front door of the Library, and the three old search
boxes are gone.

- **Wikipedia** — the encyclopaedia's own API, no key, no scraper.
- **Trusted sources** — the same search ladder the chat already uses (your
  SearXNG when you have one, then the keyless engines), so a result in the
  Library has the same provenance as one in a chat.
- **Your documents** — anything already imported, matched on title and body.

Results come back **labelled by lane rather than blended**, and every hit can be
saved **into a folder with tags**. Your own **PDF, Word and text files** can be
imported (extracted in the browser with pdf.js and mammoth, then searchable).
Add an **RSS or Atom feed** and its entries join the recommendations.

Recommendations are pulled from what you chose to watch — the tags on things you
saved and the feeds you added — and nothing else is ever inferred. With nothing
to go on it says so instead of inventing interests.

## Notifications

A bell in the rail, counting with **SmoothUI's notification badge**:

- a **new release** is announced once per version;
- **recommendations** are announced at most once a day, and are **off by
  default** — turn them on in **Settings → Notifications**;
- opening the panel marks what you looked at as read; items can be dismissed
  individually or cleared.

Nothing here touches a server. It is a local list.

## Updates that survive a dropped connection

"When an update accidentally disconnects it can automatically continue where the
progress was from" is a property of where the bytes are written, not of a retry
counter:

- the archive is streamed to a **partial file in the data directory** as it
  arrives;
- the next attempt asks for `Range: bytes=<have>-` and **appends**;
- a server that ignores Range is **detected** and restarted cleanly rather than
  producing a doubled file;
- a checksum mismatch **clears the partial** so the next attempt is not built on
  bad bytes;
- progress says **"Continuing … (attempt 2)"**, so a resumed download is never
  mistaken for a stalled one.

The desktop installer download uses the same path. Proven in `npm run r17-test`
against a server that drops a stream mid-flight, and against one that ignores
Range.

## Also fixed: the packaged app wrote its database in the wrong place

A real bug, caught by the packaged-install test in `npm run update-test`. Three
of this round's new routes (`feedback`, `library`, `skills`) imported the
database module **statically**, and `db/index.ts` opens its file as it is
imported — *before* the runtime has resolved the data directory. The result:
the app reported its database at `<your library>/db.sqlite` while actually
writing `./research-engine.db` into whatever directory the process was started
from. The imports are dynamic now, in `main()`, after the runtime is resolved,
and the test asserts the file lands inside the library where the user's data
lives.

## Also in this round

- The **reading demo** contains no `**`, no em dashes and no en dashes anywhere,
  and the reader draws emphasis itself rather than printing markers.
- The SmoothUI install's **`.dark` island is gone**: the neutral ramp is
  expressed in this app's own theme variables, so a SmoothUI component recolours
  with every palette in the picker.
- **Onboarding is nine steps** (was eight) with the new setting-up step, and the
  demo step still opens the reader.

## Installers

Windows gets a per-user `setup.exe` (no Node, no Electron, WebView2 fetched
automatically); Linux gets a `.deb` and an `.AppImage`. There is no macOS build.
CI builds them from this tag and attaches them to this release; their hashes are
recorded in `downloads/INSTALLERS.sha256` as GitHub's own digests, read back from
the release API.

Both portable archives in `downloads/` report `0.35.0-beta.1` from
`/api/health`, and `downloads/SHA256SUMS` carries their hashes.
