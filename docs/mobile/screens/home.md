# Screen: Home

Job (per brief §7.1 "one job, named in the file"): get the user into a question
in one thumb-reach, and show what to pick up next.

Mobile file: `mobile/src/screens/Home.tsx`. Desktop ancestor:
`frontend/src/components/home/HomeScreen.tsx` (recent chats `slice(0, 3)`, big
composer).

## Anatomy (390×844, portrait)

1. Top bar row (44 + status inset): profile name left (settings `profileName`,
   "Researcher" default), search-commands button right (opens Command sheet;
   the sanctioned top-zone control per `03` §2).
2. Greeting block: Display role at most once (time-of-day line, e.g. "Late work
   session?" only when 22:00–05:00; absent otherwise, no decoration by default).
3. Composer entry card (the Ask affordance mirrored inline): pill, height 52,
   `radius-card` 14; tap opens the Ask sheet at 50 % detent; label: "Ask
   Research Engine".
4. "Pick up" section (desktop README calls this recent work): up to 3 rows,
   56 pt each, title + age ("2 h ago"), long-press → open / rename / delete sheet.
   Empty state copy: "Nothing yet. Your first answer will show up here."
5. Offline-demo entry: shown only when no provider has a usable key (the
   `usableKey()` check in `lib/providers/keys.ts` is the same predicate): card
   with grad-research ground, one line: "No key yet. The on-device demo answers
   offline so nothing is ever blocked. [Try it]".
6. Privacy posture chip (only when ≠ default `private`): Caption row naming the
   mode, tap → shield sheet.

Tab bar occupies the bottom 64 + home inset; snackbar lands above it.

## States (from `../09-states.md`)

Empty: rows 4–6 remain, "Pick up" replaced by one-line onboarding nudge.
Loading: n/a (Home never awaits the network; tier-1 screen — cold content must
paint ≤ 1.2 s total per `10`).
Offline: identical, by construction; banner only if a backgrounded job pauses.
Error: n/a on Home (errors live on the screens they belong to).

## Motion

Entry: nothing (Home is the root; first paint IS the animation budget).
Tap composer: sheet slide-up 160 spring. Long-press row: 120 ms haptic + menu.
Theme switch from preview: repaint-only ≤ 10 ms (tested R1).

## Measurements

Gutter 16. Composer card 52 h, padding 12. Recents rows: 56 h, gap 4, title
Headline 17/22, age Caption 11 muted. Section labels: Caption, uppercase-off
(this app's voice), `fg` at 60 % (color-mix `fg`/`bg` 60/40 in CSS, like the
repo's `text-2` usage).

## Tier map

All inputs tier-1 (≤ 8.3 ms). Opening a chat = cached SQLite read, tier-1.
Composer submit = tier-2 (200 ms first meaningful paint).
