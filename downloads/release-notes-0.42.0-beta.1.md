# Research Engine 0.42.0-beta.1

A round of reach and reachability. Kilo Code joins the provider roster so
one more gateway is a paste-away. The reader stops short-changing
Wikipedia — the Read tab no longer comes back thinner than the Browser
tab. And everything you read gains two one-click exits: forward the page
to the AI with an instruction, or copy a real citation. On top of that,
the Library's search field stops fighting the keyboard, and folders learn
to wear your colours.

Every item here is backed by a check in the new r29-test (45 assertions)
so none of it can quietly regress, and the two existing suites that
touched the changed components — the r27 viewer matrix and the library
folder suite — were updated to match the new, intended behaviour rather
than the old.

## Kilo Code is a provider

- Kilo Code joins as an OpenAI-compatible provider pointing at the Kilo
  gateway (`https://api.kilo.ai/api/gateway`), one key in front of many
  models. It carries a full key guide — dashboard steps, key shape, cost,
  and a tip that it is a gateway, not a single model — and its own entry
  in the provider-id union.

## The reader stops short-changing Wikipedia

- Wikipedia's sibling hosts (Commons and friends) used to be pointed at a
  `*.wikipedia.org` API host that does not exist for them; they now
  resolve against their own host, so those pages read properly.
- When an extract comes back thin (under ~180 words), the reader fetches
  the parsed page — the same content the Browser tab shows — and reduces
  it, replacing the prose only when it is genuinely fuller. If markup had
  to be dropped, it says so instead of pretending it read everything.

## Forward a source to the AI

- The viewer header has an Ask the AI button. It starts a fresh chat with
  the reduced text attached and your instruction on top — Summarize
  faithfully, Key points, Quiz me on this, Explain simply, or your own
  words. The pasted source is capped at 12k characters and the prompt
  tells the model to work only from the source, so the answer stays
  grounded.

## Citations, one click

- A Cite popover builds APA 7, MLA 9 and BibTeX from exactly what the
  reader reduced — title, site, address, access date. Wikipedia gets its
  proper "In Wikipedia" form; a missing title is admitted, not invented.
  Each format is one copy away, with a note to verify authors and dates
  before you submit.

## Calmer typing in the Library search

- The gooey search field's typed-in element was a framer-motion
  layout-animated input, so projection transforms on a focused field made
  the caret jump, and its focus effect re-ran on every keystroke because
  parents passed fresh callbacks. It is now a plain input, the focus
  effect runs only on expand/collapse, and the component is memoized with
  stable callbacks — typing and deleting behave.

## Folders wear your colours

- Each folder takes one of five skins — Blue (the default), Green,
  Manila, Rose, Slate — chosen at creation from a swatch row or repainted
  later from a palette button. Colours persist through a new PATCH route
  and a migrated database column, so existing libraries keep working.
- The fan now opens to the three most recent saves instead of four; the
  full list stays one click away.

## Numbers

- New: r29-test, 45 checks (the provider entry and key guide, the wiki
  depth fallback, forward-to-AI and its cap, the citations engine, the
  GooeyInput fixes, folder colours and the three-item fan).
- Green: r28 67, r27 47, render 857, smoke 65, ui 60, library 58,
  ide-chrome 35, workbench 36, updates 34.
- The installers below are built by CI from this tag; the portable builds
  in the repository's downloads folder carry their own SHA-256 sums.
