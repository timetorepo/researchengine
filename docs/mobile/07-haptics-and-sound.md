# 07 — Haptics and sound

## 1. Haptics: event → pattern

iOS names are Core Haptics API; Android names are `VibrationEffect` /
`VibrationAttributes` (API 31+ classification, fallback amplitude timings).
Every event also has a *visual* equivalent (principle: haptics enhance, never
carry — a muted, gloved, or disabled user loses nothing).

| Event | iOS | Android | Note |
|---|---|---|---|
| Touch-down on any primary control | selection tick | `EFFECT_CLICK` (touch) | 16 ms press-ack CSS runs in parallel |
| Long-press threshold reached (menu opens) | light + `peek` ramp | light | desktop analogue: none (right-click is instant); mobile marks the 120 ms gate from brief §7.2 |
| Sheet detent snap | selection | `EFFECT_TICK` | |
| Send answer | medium | `EFFECT_CLICK` | |
| Quiz correct | light + `fill-sweep` visual | light | `shake-x` visual + medium on wrong |
| Quiz wrong | medium error | `EFFECT_HEAVY_CLICK` | never notification-type (it reads as an alert to bystanders) |
| Streak ≥ 3 first hit | light double | light×2 | desktop cue is the warning-colour flame pill (`QuizPlay.tsx:157`) |
| Timer end (focus session) | notification success | notification | also the Live Activity/notification line (FocusPill copy: "Focus complete. Time for a 5 minute break.") |
| Highlight placed | light | tick | |
| Citation chip tap | selection | tick | |
| Permission denied / blocked command (DENY list) | error | notification error | `ide.ts` blocked-reason copy plays the role |
| Companion paired | notification success | notification success | on both ends |
| Flood agent completes | light | tick | batched: 1 haptic per completion, not per token |

Rules: off-switch per category in You → Settings → Haptics (defaults all on);
no haptics during scroll (the system owns that); no haptics while the on-device
model is loading (it would compete with job progress ticks).

## 2. Sound policy

`settings.soundEffects` already exists and defaults to `false`
(`useStore.ts:75`), **and is currently unimplemented** — no `Audio`/AudioContext
call exists anywhere in `frontend/src` (verified by grep). Mobile inherits the
setting name and the default, and implements it honestly:

- **Off by default.** Nothing in the app ever plays a sound that the user has not
  enabled.
- When on, exactly two cues exist: timer end, flood completion. Both are one-shot
  sample files ≤ 200 KB, no ringtones channel. Android: routed to notification
  stream, in its own *low-importance* channel the user can silence per-channel.
- Dictation (R7) never plays earcues by default; the waveform + level meter
  (`DynamicIsland` wave-bar pattern, `globals.css:90` `.wave-bar` ancestor) is the
  feedback.
- No earcon identity, no jingle, no startup sound. One accent colour, one
  sound budget.
