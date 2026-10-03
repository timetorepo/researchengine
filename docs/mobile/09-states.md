# 09 — States, with exact copy

Every screen ships seven states. Skeletons, not spinners, are the default loading
surface (the `.skeleton` + `shimmer 1.6s` CSS in `globals.css` is the ancestor; at
Minimum the shimmer is frozen, the skeleton stays). The copy below is final unless
the round that ships the screen edits it; em dashes banned in user-facing strings.

## The state machine (applies to every screen)

| State | Trigger | Pattern |
|---|---|---|
| Empty | no data, first run or after wipe | what this is + one action, never a sad illustration |
| Loading | tier-2 in flight < 400 ms | skeleton only |
| Waiting | tier-2 > 400 ms | skeleton + one honest sentence naming what is being waited on (brief: no spinner > 400 ms without a sentence) |
| Cancelable | > 2 s | + Cancel, always (the app's SSE aborts already exist: `signal` on `lib/providers/stream.ts`, stop button on InputBar) |
| Error | failure | what failed + `why()` when the backend has one + retry + "what you can do instead" |
| Offline | no network | everything tier-1 keeps working, banner: "Offline. Your library and notes work. Web search and providers pause." |
| Unpaired | companion feature, no companion | see below |
| Permission denied | OS denial | why + open-settings link, never dead-ends |

## Canonical strings (mobile)

- **Companion, unpaired:**
  "{Feature} runs on your computer. Research Engine also runs entirely on this
  phone at a smaller scale, or with a provider you add. [Pair your computer] [Run
  smaller on this phone]" — never a greyed card.
- **Companion, pairing QR scanned:**
  "This pairs with {hostname} on your local network. This computer's fingerprint:
  {8-word phrase derived from SPKI}. Check it matches the code shown there."
- **Demo mode (flag `usedDemo` exists in `lib/chat/generate.ts`):**
  "Answered by the on-device demo engine. It is a demo: the shape of an answer,
  not research. Add a provider for real answers." (Tone matches `demo.ts`'s existing
  honesty.)
- **Search fallback to demo (`routes/search.ts` reports `backend:'demo'`):**
  "No search backend answered. These are clearly-labeled demo results so the app
  never fakes a search." + lane `why()` lines when R2 lands.
- **Top Secret posture active:** composer badge "Top Secret: only {provider} gets
  data. Search is local." (derived from `shield.ts` semantics).
- **Model too big for this device (R5):**
  "{Model} needs about {X} GB of memory. This phone can't hold it without pushing
  everything else out. [Run on your computer] [Use {smaller class}] [Add a provider]" —
  and the refusal is loud; silent down-swap is a spec violation.
- **Flood device scale:** banner "Device scale: {n} agents, {budget} token cap.
  Pair your computer for full squads." (scale, not a lockout; `floodBudget` field
  already exists.)
- **Article too long to edit well here:** "This document has {n} blocks. The full
  editor is designed for larger screens. [Edit on your computer] [Read here]
  [Edit selected block]" — the affordance is the brief's, and "Read here" makes
  it non-punitive.
- **Keyboard-blocked input (external keyboard missing):** none by design; every
  shortcut has a touch path (Command sheet = the desktop `Ctrl+K`).

## Skeleton specs

List row: 1 title bar (70 %) + 1 muted bar (40 %), radius `radius-chip`, row
height per `03`. Answer block: 3 bars at 100/100/62 %, growing to real height on
first paint of content (no layout jump: reserve with `contain-intrinsic-size`
like `.msg-row` does at 120 px). Model card: logo circle + two bars. Keep the
`RouteSkeleton.tsx` proportions; mobile strips its top-chrome block (the tab bar
is already the chrome).
