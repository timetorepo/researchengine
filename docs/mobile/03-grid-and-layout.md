# 03 — Grid and layout

**Base: 4 pt grid, 8 pt rhythm** **[gate — new; the repo has no spacing scale, see
`01-tokens.md` §3].** Every margin/padding/size is a multiple of 4; blocks stack
on multiples of 8. Exceptions granted only to hairlines (1) and focus offset (2),
both inherited from `globals.css`.

## 1. Gutters and frames

| Frame | Gutter (x) | Edge-to-edge card bleed | Verified reference |
|---|---|---|---|
| Phone ≤ 390 pt (e.g. 320×568 floor) | 16 | none — cards inset | brief §8 |
| Large phone 391–440 (390×844, 412×915, 430×932) | 16 | reader full-bleeds art only | the design-preview widths, same list as brief |
| Tablet / foldable open | 24 | 2-column list + detail | |

Max content width for prose: 68 ch, centred, never stretched (reader, answers).
The desktop reader is 720 px (README §Read&Quiz); mobile prose is measured in
characters, which keeps the same texture at 390 pt.

## 2. The three horizontal zones (one-handed reach map)

Assumes right thumb; mirrored for left-hand mode (OS setting, respected, no
in-app toggle duplicating it).

| Zone | Vertical extent (from bottom, phone) | Lives here |
|---|---|---|
| Home / comfortable | 0 → 160 pt | tab bar (64 pt + safe area), Ask, composer send, sheet primary buttons, quiz answer buttons, snackbar (above tab bar, 8 pt gap) |
| Stretch | 160 → full−96 pt | content, scrolling, cards; anything reachable by thumb *drag* (scroll-to-top via overscroll, not a button) |
| Reachable-only-by-reach | top zone minus status | back (edge-swipe + 12 pt inset button), sheet *grabber* row, live counter. Destructive actions NEVER here (brief §7.1); search field is the one sanctioned top-zone control because tapping starts an edit, and the keyboard then makes it thumb-reachable. |

Top bar height 44 + status inset; tab bar 64 + home-indicator inset (12) — sizes
from the Dribbble pattern study (§9 of the brief), validated against
`44×44/48×48` minimum at 320×568 in the design preview.

## 3. Safe areas

- iOS: honour `env(safe-area-inset-*)` on all four edges; composer and sheet
  buttons add `max(inset.bottom, 8)`; Dynamic Island region carries only the
  focus-timer compact view (mirrors `os/DynamicIsland.tsx` semantics).
- Android: `displayCutout: shortEdges` never under刘海 for interactive elements;
  edge-to-edge with insets applied at the shell (`re-core` exposes the numbers,
  WebView consumes via CSS vars written on `:root`).
- Keyboard: `100dvh` + visualViewport tracking. Anti-pattern #10 applies: the
  composer lifts with the keyboard (transform, not scroll), the answer view keeps
  its scroll position (scroll ownership rules in `screens/chat.md`).

## 4. Landscape, foldables, tablets

- **Allowed:** reader (book spread at tablet), quiz results share card preview,
  video-free long-form reading — the brief's list, unchanged.
- **Refused:** chat compose, Flood, workflows, settings, pairing. Rotating these
  returns to portrait with no reload (the app never re-lays-out destructively).
- Foldables: crease = gutter (content never under the hinge); unfolded state
  renders the tablet grid; the phone half keeps the phone layout — one component
  tree, two metrics (tokens, not forks).

## 5. Density

Default density = "comfortable": row 56 pt lists, 44–52 pt controls. `compact`
exists on desktop (`globals.css` `.compact` = 13.5 px base). Mobile exposes
**one** density control (You → Appearance → Density) that maps to the same class,
because 200% text × compact is a contradiction — density auto-disables above 130%
text scale and the setting says so in one line of copy.
