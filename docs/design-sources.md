# Design sources

What was taken from each reference site, and exactly where it landed. Nothing
here is a screenshot dropped into the app — every item is reimplemented with the
app's own components and tokens, so all 20+ themes keep working.

## Cult UI — https://www.cult-ui.com

Animated, shadcn-style components. Closest match to this codebase's stack
(Tailwind + framer-motion + CSS variables), so it is where most of the movement
comes from.

| Component | What was borrowed | Where it lives now |
|---|---|---|
| [Dock](https://www.cult-ui.com/docs/components/dock) — macOS magnification | Icons swell under the pointer, neighbours lean away to make room, name flies out beside the icon | Collapsed sidebar (`DockRail` / `DockItem` in `components/sidebar/Sidebar.tsx`). Falloff is a pure function (`dockMetrics`) so it is testable: 1.6× pointed, 1.26× next, 1.08× two away, flat after that |
| [Timer](https://www.cult-ui.com/docs/components/timer) | Compound parts (icon / display / progress / controls), sizes, and a **tabular** clock so digits never jitter | `components/shared/FocusPill.tsx` — the focus timer block |
| Dock references | React-spring macOS-dock sandbox + Buildui "magnified dock" (linked from their docs) for the lean/push behaviour | same as Dock above |
| Dynamic Island / morph pattern | One surface at two sizes rather than a popover appearing | Focus pill → rounded block: the pill's width and radius spring open and the body slides out of it |

Deliberately **not** taken: their `Texture Card`, `Neumorph` buttons and Pro
component set. This app already has a card language (`surface-elevated`,
`--radius-card`) and mixing in a second one is how a UI starts to look assembled
instead of designed.

## Watermelon UI — https://ui.watermelon.sh

A catalog of blocks, showcases and dashboards rather than primitives.

| Item | What was borrowed | Where it lives now |
|---|---|---|
| Landing-block rhythm (Announcement / Bento / Blog blocks) | Section spacing ladder and heading-to-body ratios for the block layouts | Reference only — the home screen already follows this rhythm, and the agent-readable entry points (`llms.txt`, `openapi.json`, MCP) were noted in case this project ever publishes a component catalog |
| Expandable Profile Card | "Card grows in place, secondary actions revealed on demand" | Same interaction as the profile popover (`ProfilePill`) and the dock labels |
| Shuffle Pinned List / Card Swipe | Drag-to-reorder affordances | Not adopted: the app has no reorderable lists that would benefit yet |
| Adaptive Sliders | Control that changes its step size with the value | Not adopted (no such control in this app) |

Honest note: Watermelon had the weakest direct mapping of the three. Its value
here was the **block/page composition grammar**, which this app already uses;
nothing was forced in. The `llms.txt` / MCP endpoints are the part worth keeping
an eye on.

## Refero — https://refero.design and https://styles.refero.design

Real product screens, flows and patterns; **Styles** turns each into an
AI-readable `DESIGN.md` (colours, typography, spacing, components). Not a
component library — it is taste, as data.

Trending styles studied: **Linear** (midnight precision instrument), **Vercel**
(typeset terminal on white), **Cursor** (warm parchment atelier), **Ramp**
(editorial finance desk), **ElevenLabs** (warm cream editorial), **Superhuman**
(golden hour dashboard).

What was actually applied:

| Pattern | Applied as |
|---|---|
| One accent per surface; quiet chrome, loud content | Toasts keep the app's blurred glass card and carry tone in **one** coloured icon — never a repainted background — the same discipline the previous toast used, now with Sonner's physics |
| Hairline separation over boxes | Dock dividers, top-bar build chip: 1px `--surface-border`, no background blocks |
| Instrument-grade numbers | Tabular numerals everywhere a value ticks (timer, savings counter) — a clock that reflows its own width is the classic tell of a fake one |
| Precision motion | 150–300 ms, `cubic-bezier(0.22, 1, 0.36, 1)`, springs only where something is being grabbed or thrown |
| "Designed, not generated" | The rule used to decide what *not* to add: if a screen only needed one new idea, it got one |

Refero's MCP endpoint (`refero.design/mcp`) is the practical way to keep this
going: it gives an agent the reference library directly instead of screenshots
in a prompt.

## The one rule that keeps this from breaking the UI

Everything above is additive and theme-driven: colours come from CSS variables,
surfaces from `--glass` / `--surface-border`, motion from the existing springs
and `--ease-ios`, and every new animation is disabled under reduce-motion
(`.reduce-motion`, `prefers-reduced-motion`). The suites that guard it:
`render-check` (dock falloff, top-bar contents, Sonner bridge, timer labels,
Developer tab), `ui-test`, `smoke`, `sample-test` (including the live
create-project bench) and `design-test`.

## Product reference skins — Claude, ChatGPT, Gemini

The three AI-product themes copy the products' *layout*, not only their colours. References were collected from search and checked against screenshots:

- **Claude** — serif greeting with a terracotta mark, a rounded composer with a `+` menu bottom-left (files, projects, research, web search, style, connectors) and a model picker plus mic bottom-right. Source: Claude chat screenshots (substack guide, 2025).
- **Gemini** — dark Material canvas (`#131314`), a fully rounded "pill" composer with `+`, a Tools chip, a Fast/model picker, mic and send, and suggestion pills below. Source: Gemini prompt-bar screenshots (Yahoo Tech, ThoughtsBrewing).
- **ChatGPT** — centred near-black composer with tight radii and the mint accent.

The composer silhouette is set per theme through `[data-skin-composer]` in `globals.css`.

## Provider marks — simple-icons

Anthropic, Google Gemini, NVIDIA (NIM), Ollama, Mistral, Perplexity and LM Studio use official single-colour paths generated from `simple-icons` into `components/shared/brandMarks.ts`. OpenAI, Groq and Together keep their earlier marks because `simple-icons` no longer ships them.

## Circuit board — componentry

`components/ui/componentry/circuit-board.tsx` is the componentry circuit-board source, taken from the public `Leonxlnx/taste-blocks` registry mirror because `@componentry/circuit-board` is not on npm and the shadcn registry host was unreachable from the build sandbox. Re-check against the upstream registry when it is reachable.
