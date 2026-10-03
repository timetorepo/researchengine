# 01 — Tokens: the single source and the real values read out of the repo

Source of truth (mobile): `packages/tokens/tokens.json`. Generated from it:
`tokens.css` (Tailwind v4 / WebView), `ReTheme.swift` (native islands + Live
Activity), `ReTheme.kt` (widgets + foreground-service tiles). The generator and
its match-test ship in R1.

Today (desktop) the tokens live as CSS custom properties in
`frontend/src/styles/globals.css` (705 lines, 12 theme blocks) and theme *metadata*
in `frontend/src/lib/themes/meta.ts`. `tokens.json` is extracted from those two
files; the drift test asserts byte-equality of the values. When desktop moves onto
the same JSON (R2 follow-up, logged in `docs/mobile/README.md`), there is exactly
one file left to edit.

## 1. Semantic colour set — old name → new token name

The brief lists `surface/raised/line/fg/muted/faint/brand/danger/success/warning`.
The repo uses different names; the mapping is fixed here so documents and generated
code share one vocabulary:

| New token | Current CSS var | Default-Dark value (from `globals.css`) | Role |
|---|---|---|---|
| `bg` | `--bg` | `#0A0A0B` | page canvas |
| `surface` | `--surface` | `#131316` | cards, sheets, bars |
| `raised` | `--elevated` | `#1A1A1F` | pressed/selected, inner cards |
| `line` | `--surface-border` | `rgba(255,255,255,0.06)` | hairline borders (`*` default border colour) |
| `fg` | `--text` | `#F4F4F5` | primary text |
| `muted` | `--text-2` | `#A1A1AA` | secondary text |
| `faint` | `--text-3` | `#52525B` | tertiary text, scrollbar thumb base |
| `brand` | `--primary` | `#6C8EEF` | accent, focus, links, active |
| `brand-hover` | `--primary-hover` | `#8B9FFF` | press emphasis (mobile: not hover — no hover) |
| `brand-2` | `--secondary` | `#A78BFA` | secondary accent in gradients/orbs only. **Not a third colour; one accent system** |
| `success` | `--success` | `#34D399` | correct, ok |
| `warning` | `--warning` | `#FBBF24` | caution, math-mode accent |
| `danger` | `--danger` | `#F87171` | destructive, error |
| `code-bg` | `--code-bg` | `#101014` | code block ground |
| `scrim` | `--scrim` | `rgba(0,0,0,0.55)` | sheet/modal dim |
| `glass` | `--glass` | `rgba(19,19,22,0.72)` | translucency base (see §4) |
| `aurora-a/b` | `--aurora-a/--aurora-b` | `rgba(108,142,239,0.07)` / `rgba(167,139,250,0.06)` | background wash |
| `grad-research/math/quiz/article/flood` | `--grad-*` | mesh gradients (4-stop multi-radial), listed verbatim in `tokens.json` | category cards; `data-grad="theme"` swaps to color-mix-derived versions |

`::selection` = `color-mix(in srgb, brand 35%, transparent)`.
Focus ring = `2px solid brand`, offset `2px`, radius `4px` (already in CSS).

## 2. The 12 themes — values as found (`meta.ts` swatches + `globals.css` blocks)

`meta.ts` exposes swatches `[bg, surface, primary, secondary]`; the full semantic
set per theme is below (dark/light from CSS; the Catppuccin/Nord/Solarized/Hc/
re-os/perplexity blocks are read from the same file).

| id | name | kind | bg | surface | brand | brand-2 |
|---|---|---|---|---|---|---|
| `dark` | Default Dark | dark | `#0A0A0B` | `#131316` | `#6C8EEF` | `#A78BFA` |
| `light` | Default Light | light | `#FAFAFA` | `#FFFFFF` | `#4F6FE0` | `#8B5CF6` |
| `catppuccin-latte` | Catppuccin Latte | light | `#eff1f5` | `#e6e9ef` | `#1e66f5` | `#8839ef` |
| `catppuccin-frappe` | Catppuccin Frappé | dark | `#303446` | `#292c3c` | `#8caaee` | `#ca9ee6` |
| `catppuccin-macchiato` | Catppuccin Macchiato | dark | `#24273a` | `#1e2030` | `#8aadf4` | `#c6a0f6` |
| `catppuccin-mocha` | Catppuccin Mocha | dark | `#1e1e2e` | `#181825` | `#89b4fa` | `#cba6f7` |
| `nord` | Nord | dark | `#2e3440` | `#3b4252` | `#88c0d0` | `#b48ead` |
| `solarized-dark` | Solarized Dark | dark | `#002b36` | `#073642` | `#268bd2` | `#6c71c4` |
| `solarized-light` | Solarized Light | light | `#fdf6e3` | `#eee8d5` | `#268bd2` | `#6c71c4` |
| `high-contrast` | High Contrast | dark | `#000000` | `#0d0d0d` | `#82aaff` | `#c4a7ff` |
| `re-os` | ResearchEngineOS | dark | `#08080c` | `rgba(22,22,28,0.66)` | `#6C8EEF` | `#A78BFA` |
| `perplexity` | Perplexity | dark | `#1F1F1F` | `#2A2A2A` | `#20B8CD` | `#7BD8E6` |

Theme-specific facts that the JSON must carry (all read from `globals.css`):

- **`re-os` makes `surface` and `raised` themselves translucent**
  (`rgba(22,22,28,0.66)`, `rgba(30,30,38,0.72)`) and its `code-bg` too —
  the layered-translucency model the mobile "shader-free glass" wants, already in
  a shipped theme. `raised` alpha, not blur.
- **`perplexity` tightens radii**: chip 6 / card 10 / modal 16 px (block after the
  theme colours). Radius is *themeable*; the scale below is the default.
- `light` redefines the five `--grad-*` meshes (its own palette), `perplexity`
  redefines `--grad-research` only. `tokens.json` stores grad overrides per theme,
  same as CSS cascade today.
- `high-contrast` raises `line` to `rgba(255,255,255,0.25)` and dims aurora washes
  to 0.05/0.04 — the accessibility theme is also the cheap-GPU theme; mobile's
  Minimum ladder adopts HC line weights.
- `THEME_CAPTIONS` exists (`perplexity`: "Inspired by a familiar research tool.") —
  keep the map in `tokens.json` so mobile pickers show it without importing meta.ts.

## 3. Shape, space, type anchors (read from `globals.css :root`)

| Token | Value | Note |
|---|---|---|
| `radius-chip` | 8 px | |
| `radius-card` | 14 px | comment in CSS: "Shape scale (MD3): chip 8 / card 14 / modal 24 / pill 999" |
| `radius-modal` | 24 px | mobile sheets keep 24 top-only (see `04`) |
| `radius-pill` | 999 px | |
| `font-ui` / `font-body` | `"HK Guise", "Avenir Next", "Satoshi", "Geist Sans", "Inter", ui-sans-serif, system-ui, sans-serif` | HK Guise first *when installed*; bundled fallbacks are Geist Sans + Inter (`@fontsource` in package.json). Mobile bundles: **Geist Sans only** in R1 (license + weight), HK Guise stays a desktop-only preference — documented in `12-platform-differences.md` §fonts |
| `font-mono` | `"Geist Mono", ui-monospace, "SF Mono", Menlo, monospace` | |
| `font-serif` | `"Lora", Georgia, serif` | reader prose option, bundles `@fontsource/lora` |
| `font-size base` | `calc(15px × --font-scale)`; compact mode `13.5px` | `--font-scale` set by `applyTheme()`; mobile maps `--font-scale` → Dynamic Type instead of a slider (see `02`) |
| `--spring` | `cubic-bezier(0.32, 0.72, 0, 1)` | **not** the brief's `[0.22, 1, 0.36, 1]`; the repo value wins (see `06-motion.md` §1) |
| scrollbar | width 8 (6 in `.pane-scroll`), thumb `color-mix(faint 45–70%, transparent)`, hidden until hover/scroll | mobile: overlay scrollbars by platform, thumb colour reused |

**Spacing: the repo has no custom spacing scale.** Tailwind v4 defaults + ad-hoc
`p-3/gap-2` etc. in components. The brief imposes 4 pt base / 8 pt rhythm, so
`tokens.json` introduces it (`space-1…space-10`), and mobile is written to it from
R1. Desktop keeps its Tailwind values; drift is acceptable here because nothing
yet shares it. This is recorded as a deliberate, temporary fork — `03` and `12`
each cite it.

## 4. Blur policy (what "glass" becomes on mobile)

Found in code today: `.glass { backdrop-filter: blur(24px) saturate(1.4) }` — and
9 `backdrop-filter` rules across `globals.css`, plus `glassMode: off | liquid |
blur` in Settings (Appearance) and the aurora washes (`blur(90px)` static blobs,
cheap because they do not composite per frame under content).

Mobile policy **[gate]** (brief §5.2, enforced by the ladder in `10-performance.md`):

- **Full:** live blur on at most the composer + top bar (2 surfaces).
- **Lean:** `glass` = layered translucency (`rgba` from `--glass` values above,
  which are already solid-alpha) + 2 % static noise texture, no `backdrop-filter`.
- **Minimum:** `glass` == `surface`, no alpha compositing behind scrolling content,
  transitions instant.
- **Never:** blur on any scrolling surface. `backdrop-filter` on a list is a CI
  lint failure (rule in `mobile/` build).

## 5. Elevation

Repo has no elevation scale (borders + one `box-shadow` in `.card-hover`:
`0 12px 32px -12px rgba(0,0,0,0.45)`). Mobile defines
`elevation-1 = none (line only)`, `elevation-2 = 0 1px 2px rgba(0,0,0,.35)`,
`elevation-3 = 0 12px 32px -12px rgba(0,0,0,.45)` (reuse `.card-hover` value),
`sheet = 0 -8px 40px -12px rgba(0,0,0,.55)`. Shadows carry colour-blind depth;
they never carry meaning alone.

## 6. What `tokens.json` does NOT contain

Provider list (still `registry.ts` until the merge question is decided — see
`parity-matrix.md` §1.1.4), model names (fetched live, "NEVER hardcoded" is a
comment in `registry.ts` and a rule), and any copy (copy lives with screens,
`09-states.md` fixes only the strings that are states).
