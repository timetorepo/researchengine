# 06 — Motion

## 1. The curve question, settled by reading the code

The brief cites a site curve `[0.22, 1, 0.36, 1]`. **This checkout's shared curve
token is `--spring: cubic-bezier(0.32, 0.72, 0, 1)`** (`globals.css` :root, used
by `.card-hover`, `.msg-settle`, `.sonar-ring`, `.fill-correct::before`). The repo
value wins for continuity; the brief's value appears nowhere in the code and is
**not** adopted. Second documented curve: `cubic-bezier(0.2, 0.6, 0.2, 1)` for
the streaming reveal (`md-blur-reveal`, same file).

## 2. Duration ladder **[gate, brief §5.3]** with real ancestors

| Event | Mobile duration | Curve | Already exists as |
|---|---|---|---|
| State toggle / press ack | **90 ms** (0 on Minimum) | spring | desktop press ack is 16 ms (`globals.css:421` `.press-tap`), kept for transform, extended window for state |
| Sheet enter | **160 ms** | spring | — (new) |
| Screen push | **240 ms** | spring | `.msg-settle` is exactly 240 ms var(--spring) |
| Largest move (reader open, result card) | **320 ms** | spring | `.shake-x` runs 320 ms; `.card-hover` is 180 ms (retired on mobile) |
| Anything > 400 ms | only answer pacing — content, not chrome | pacer owns it | `flow/engine.ts` word micro-timing 30–80 ms, punctuation pauses, `pacingSensitivity`, `cinematic` mode |
| Streak/confetti, result celebration | 360 ms sweep | spring | `.fill-correct::before fill-sweep 360ms` |
| Ambient (orb, aurora) | 80 ms word settle / 1.4 s orb breathe / 90–110 s aurora drift | linear/ease | `.stream-word`, `.re-orb`, `.aurora` — **all ambient layers die at Lean/Minimum**, ladder decides, never the developer |

## 3. Choreography per flow (the brief's list, each one sentence per step)

- **Open a chat from Home:** recents card scales 0.98→1 (90) → header fades in
  (90, delay 40) → messages translate-y 8→0 (160, stagger 20, cap 5 then hard
  stop animating — `10` budget rule).
- **Send:** composer collapses to message row in place (160) — the message does
  not fly to a new position, it *is* the old position. FlowStages appear at
  composer height (90 each, never two at once — one spotlight per screen).
- **Stream:** only the last block animates (`md-blur-reveal`/`word-settle` are
  already exactly this: `.msg-streaming .md-body > *:last-child`). The caret
  rides the tail (2 px bar in `Message.tsx` path, 7 px in `.md-body::after` —
  mobile standardises on 2 px; the 7 px duplicate is desktop legacy, noted in
  R8 cleanup).
- **Highlight:** handles follow the finger 1:1 (spring, no duration — direct
  manipulation bypasses the ladder); on release, `fill-sweep` 360 over the marks.
- **Answer quiz:** button press 90; correct = sweep 360 + light haptic; wrong =
  `shake-x` 320 + medium haptic; auto-advance waits for sweep end (no stacking).
- **Open sheet:** grabber leads (160), content children fade (90, delay 80).
- **Switch tab:** cross-fade 90, no slide (slides imply a sequence the 3 tabs
  do not have); scroll positions are preserved so the fade is the whole cost.

## 4. Springs for gestures, curves for choreography **[gate]**

Draggable things (sheets, highlight handles, edge-swipe) use springs:
`{ stiffness: 420, damping: 38 }` at Full, damped out (`damping: 44`) at Lean,
absent (instant snap) at Minimum. Non-interactive choreography uses the cubic
curves in §2. Interrupted transitions continue from current state (brief §5.3),
which `framer-motion` (v11 here — **not** the `motion` package; the brief's name
is the v12 rename) supports natively with `layout` off everywhere it would
animate size.

## 5. Reduced motion

`globals.css` already: kills orb, caret animates to static 0.6 opacity, press
transform off, wf-node anim off (`@media (prefers-reduced-motion)` blocks at
lines 363, 399, 424, 439 + a global duration-killer at ~640). Mobile keeps that
global duration-killer as the OS-switch path and adds the in-app
"Reduce motion" (`settings.reduceMotion` exists) which collapses to opacity-only
instead of to nothing (streaming reveal becomes fade, highlight sweep instant).
`prefers-reduced-transparency` also honoured: forces Minimum ladder floor.
