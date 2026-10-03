# 02 — Type on phones

Base facts read from the repo: desktop base is 15 px (compact 13.5 px) scaled by
`--font-scale`; `--font-ui/--font-body` stack starts HK Guise and falls back to
Geist Sans/Inter; mono is Geist Mono; serif is Lora; `.md-body` line-height 1.6.
Markdown component: `frontend/src/components/chat/Markdown.tsx` (react-markdown +
remark-gfm + remark-math + rehype-katex).

Mobile does **not** carry `--font-scale` as a product control. Text size is the OS
control (Dynamic Type / non-linear font scale); the app obeys it completely.

## 1. Roles

Sizes in pt (iOS) / sp (Android, 1.0 scale). **[gate]** column is the mobile
scale; "desktop cousin" cites where the same voice exists today so the two
families stay recognisable.

| Role | Mobile size / LH | Weight, tracking | Desktop cousin | Max lines | Scales to 200%? |
|---|---|---|---|---|---|
| Display | 34 / 40 | 600, −0.02 em | HomeScreen big prompt (`text-[26px]`-range hero) | 3 | yes, wraps |
| Title | 22 / 28 | 600, −0.01 em | StepHeader `text-[20px] -0.02em` (Onboarding.tsx:319) | 2 | yes |
| Headline | 17 / 22 | 600 | chat titles, section heads | 2 | yes |
| Body | 15 / 24 (1.6 like `.md-body`) | 400 | answer prose | ∞ (paging, not ellipsis) | yes |
| Callout | 13 / 18 | 400–500 | card descriptions (`text-[12.5px]`/`13px` patterns in AppearanceTab:257, InputBar) | 3 | yes |
| Caption | 11 / 14 | 500, +0.01 em | tab-bar labels (Dribbble pattern, brief §9), stats | 2 | floor: scales to 150% then holds |
| Mono | 13 / 20, Geist Mono | 400 | code blocks (`--code-bg` ground) | ∞ wrap-off, horizontal scroll | follows body |

Anti-pattern #4 from the brief is law: **no content under 12 pt, nothing under
11 pt** — Caption at 11 is the only permitted 11 and only for labels, never
running text. `body` default = 15, matching desktop, so answers look like the
same product.

## 2. Dynamic Type behaviour

- iOS: roles map to text styles (Body→.body, Title→.title2, Display→.largeTitle,
  Caption→.caption1, Mono→.body with monospaced design). App respects up to
  AX sizes by collapsing *layout*, never *text*: at >170% the tab bar labels
  drop to icon-only, card grids go 2-col → 1-col, the one-line preview
  (`-webkit-line-clamp`) becomes 2 then full on tap-to-expand.
- Android: sp units end-to-end; `fontScale` beyond 1.15 triggers the same
  collapses (test list in `08-accessibility.md`). Display role caps at 1.6× so a
  200% hero cannot push the composer off-screen; everything else is uncapped.
- Truncation rules: lists truncate mid-word with ellipsis and the *full* string
  is in the row's long-press sheet; titles clamp 1; captions clamp 2; answer
  prose never truncates (virtualized, see `10`).

## 3. What the scale does to the grid (the spelled-out consequence the brief asks for)

At 100%: Home shows composer + 3 recent cards (`recentChats.slice(0,3)`,
HomeScreen.tsx:53). At 200%: cards become list rows, recents cap at 2, the
Display collapses to Title (one idea per screen survives reflow). Reader prose
gains measure: line length is capped at 68ch by *size*, so 200% text means
fewer words/line and more vertical scroll — never reduced line-height.

## 4. Numerals, timers, code

- Timers/streaks/scores use tabular figures (`font-variant-numeric: tabular-nums`) —
  today `AnimatedCounter` (ui/reactbits) does the roll on desktop; mobile keeps
  tabular nums, drops the roll animation at Lean/Minimum (`06`).
- `0A:03` style clock: Mono role, 17 pt, never Caption (a tiny timer is a
  misread timer).
- Katex blocks inherit Body size with `.katex { font-size: 1.06em }`-class bump;
  at ≥150% display math scrolls horizontally instead of shrinking.
