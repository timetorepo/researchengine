# 00 — Principles for Research Engine on a phone

Five principles. Each one has a therefore-do and a therefore-do-not, because a
principle without a rejected behaviour is a slogan.

## 1. Local-first is visible

The app's whole argument is that the work happens on your device. That argument
is only real if the user can see it, so every surface says where the work ran.

- **Therefore we do:** label the answering engine on every answer (provider name
  or "on-device demo" — the flag already exists in code as `usedDemo` in
  `frontend/src/lib/chat/generate.ts`, and `backend/src/routes/search.ts` already
  reports which search backend answered). Label companion scale vs device scale
  on Flood. Show the library folder path in You → Advanced → Storage.
- **Therefore we do not:** draw a generic "AI is thinking" state that could be
  either engine, or ship a "demo" answer that reads like a real one. The demo
  copy in `providers/demo.ts` is the tone model: clearly labeled, still useful.

## 2. One thumb

The design unit is the thumb on a 6.1–6.7" screen, and half the time the other
hand is in a pocket.

- **Therefore we do:** put primary actions in the bottom third, targets ≥ 44 pt
  iOS / 48 dp Android with no exceptions (brief §7.1, `03-grid-and-layout.md`),
  the Ask action raised mid-tab-bar, and nothing destructive top-right.
- **Therefore we do not:** reflow desktop layout "just for now", place any primary
  control above the horizontal midline on phones, or use a hamburger for primary
  navigation. Ever.

## 3. Never lie about state

A spinner is a claim. "Offline" is a claim. A greyed button with no reason is a
false claim by omission.

- **Therefore we do:** the numbers from `11-latency.md` (sentence beside every
  spinner past 400 ms, cancel path past 2 s, no blank screens in navigation);
  unpaired companion states that say what they need and offer one action; the
  quality ladder announcing itself ("holding 118 fps at Lean; thermal state serious").
- **Therefore we do not:** show a fake progress bar, keep a spinner past its
  sentence, or hide a feature with `display:none`. No feature is disabled for
  performance, ever — fidelity drops, capability does not (brief §1.4).

## 4. Motion explains

Transitions are a map. A thing that moves shows where it came from and where it
lives now; a state that changes acknowledges the change within one frame.

- **Therefore we do:** touch-down press acknowledgement (`globals.css` already
  ships `.press-tap { transition: transform 0.016s }` — the 16 ms press is the
  desktop pattern, mobile keeps it and adds haptics); screen transitions that
  continue from the interrupting gesture; one spotlight animation per screen;
  `prefers-reduced-motion` collapsing to opacity — the desktop CSS already does
  this for orb/stream/glitch animations, mobile applies the rule app-wide.
- **Therefore we do not:** animate layout properties, parallax, scroll-jack, or
  run a 12-second intro that a thumb cannot skip. Long transitions are the risk,
  not the feature.

## 5. No feature left behind

The phone is the app, not the app's tray. Anything desktop does, the phone does —
at a stated scale when physics demands it, never silently.

- **Therefore we do:** the parity matrix (`parity-matrix.md`) is a contract, one
  row verified per feature by a test; reduced scales (Flood 2–3 agents on device)
  are shown in the UI as scale, with the full-scale path beside them; every
  "needs a computer" screen ends in a pairing action, not a dead end.
- **Therefore we do not:** ship a "lite mode", a read-only mobile feature, or a
  row in the matrix that quietly becomes `N/A on mobile`. If a row must change,
  the change goes into `parity-matrix.md` with a reason before it goes into code.

*(These five are the brief's five, in order, each sharpened against what the
0.16.0-beta.1 code actually does — per the kickoff, this document is the design's
constitution and the matrix is its statute book.)*
