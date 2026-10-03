# 08 — Accessibility

Verified existing behaviour the mobile app keeps: `:focus-visible` 2 px brand
outline (`globals.css:292`); `prefers-reduced-motion` honoured throughout;
`aria-label`s on icon buttons in the repo (e.g. InputBar "Remove image",
TopBar "Open menu"); `color-scheme` per theme (dark/light) so form controls and
scrollbars match; selection colour defined; `.compact` + `--font-scale` plumbing.

## 1. Contract **[gates]**

| Item | Requirement | How proven |
|---|---|---|
| Text contrast | ≥ 4.5:1 all themes incl. `faint` on `surface`; ≥ 3:1 non-text (borders count as "visible boundary" only where they are the state) | CI check over `tokens.json` pairs, all 12 themes, both modes |
| Text size | Dynamic Type to 200%: all roles scale, layout consequences per `02-type.md` §3; 320×568 + 200% is the torture frame | design-preview screenshot matrix + a11y CI pass |
| Targets | ≥ 44 pt / 48 dp everywhere, **no exceptions** (brief §3 of `08`'s anti-list); 8 pt gap between adjacent targets | lint on component metrics in design preview |
| Reader labels | every screen has a `Screen`/header label; primary flow per screen listed in `screens/*.md` § VoiceOver / TalkBack | manual checklist per round, R8 sign-off |
| Focus order | DOM order = visual order; sheets trap; back gesture never needs focus | TalkBack/VoiceOver walk per screen |
| Rotor content | reader: headings/landmarks present from `Markdown.tsx` output contract (headings are real h1–h6, list are real ul/ol) | a11y tree test in mobile preview harness |
| Haptics/motion/audio | all independently off-able (`06` reduce-motion, `07` switches) | settings round-trip test |
| Switch Control / Voice Control | labels + `accessibilityAction(label:)` equivalents for gesture-only affordances (long-press → always a menu button for the same actions) | per-screen test in `screens/*.md` |
| VoiceOver streaming | streaming text is announced as *blocks complete*, not per word (buffer the same completed-segment memoization `10` uses; `aria-live="polite"` on the answer region only) | scenario test |
| One-handed | everything in `03` §2 comfort zone includes all *destructive confirmations* too | reach-map review per screen |
| Colour independence | quiz right/wrong pairs sweep/shake shapes (fill vs. shake motion), tool states carry icons, Privacy Shield shows name text — colour never alone | review list |

## 2. The acceptance list (R8 gate, same list for both platforms)

1. 200% text on: Home, Chat, Reader, Quiz, Settings — screenshot set in CI, no
   clipped primary controls, no overlap (design-preview frames 320×568 and 430×932).
2. VoiceOver/TalkBack full flow: pair a companion, send an answer, highlight a
   sentence, answer 3 quiz questions, back out. Zero unlabeled controls.
3. Reduce-motion on: nothing animates longer than 90 ms opacity; streaming still
   reads (settles block-wise).
4. Contrast: axe/lint sweep = 0 failures; manual OLED check on `high-contrast`
   and `dark`.
5. Voice control: "tap Ask", "scroll down", "show menu" work on every screen
   (labels are verbs).
6. Dark→light theme flip mid-flow: no flash, no size jump (theme switch is
   repaint-only, measured ≤ 10 ms in R1 test).
7. Screen-reader announcement budget on the chat screen: ≤ 1 utterance per
   completed answer block, ≤ 2 s apart.

## 3. Known repo debt the port inherits and must not repeat

`Markdown.tsx` currently relies on browser defaults for code blocks (no
`tabIndex`); the reader's floating highlight button on desktop is hover-adjacent
(`ReaderView.tsx` ~line 274) — mobile replaces it with the selection toolbar, so
the accessibility bug does not port. Tracked here so R8 can close it on desktop
too.
