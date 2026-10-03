# 13 — References: the study, as a brief

Method per the port brief §9: each reference source answered a specific design
question, and each entry states a **take** and a **reject**. Links to live
external galleries (Awwwards, Dribbble, Refero) cannot be verified from this
sandbox — every named study below is marked *to-verify on device/with access in
R2*, and the decision rows are what actually bind. Anti-patterns #1–18 from the
brief are adopted verbatim as rejections; they are not re-litigated here.

## Refero — flows, per screen (structured by the eight reference sets the brief names)

| Screen | Reference set | Decisions it settles (3 each, from the flow pattern family) |
|---|---|---|
| Onboarding | Onboarding flow | (1) show the privacy posture before asking anything; (2) every step skippable, matching `Onboarding.tsx`'s existing "Every step is skippable and re-runnable" promise from the README; (3) end inside a live chat, not a "Get started" dead end |
| Chat | Chatting & messaging | (1) composer owns the bottom, content scrolls behind it; (2) scroll ownership: user-up pauses follow-streaming, tap returns it (the stop-button pattern in `InputBar` generalizes); (3) streaming states are named by what's happening (FlowStage labels are already this: "Reading sources", "Composing response") |
| Search | Searching pattern | (1) lanes visible while typing; (2) empty results explained with the fallback chain that ran (`/api/search` already returns `backend`); (3) recent + saved queries above results, no "Popular searches" theatre |
| Transfers | Uploading & downloading | (1) per-file progress with pause/resume, backgrounded transfers survive app-close (job queue, R2); (2) cellular pause for model downloads is a *setting shown at decision time*, not buried (brief §4.2); (3) completed transfer = haptic + one-line, no celebration modal |
| Themes | Personalizing & customizing | (1) theme switch is repaint-only, ≤ 10 ms (R1 test); (2) live preview *behind* the picker, not a screenshot of it; (3) favorites row from `settings.themeFavorites` carries over unchanged |
| Home | Activity & notification feed | (1) Home shows *your* recent work (the `recentChats` pattern), not a feed; (2) no third-party content cards; (3) at most three pickups before the composer (desktop shows three: `slice(0,3)`) |
| Dark mode | Dark mode pattern | (1) OLED default `#0A0A0B` (not pure black — `high-contrast` owns pure black `#000000`, the two themes already separate those jobs); (2) elevation-by-lightness + hairline `line`, not shadow (the repo's model); (3) aurora washes stay ≤ 0.12 alpha (measured values in `01` §2) |
| Chrome | Nav bar / drawer / dialog | (1) tab bar 3 + 1 (reject drawer; reject 5-tab); (2) sheets with detents, drag-to-dismiss; (3) dialog only for confirmations, never for information (information is a screen or a sheet) |
| First screen of AI products | AI tools set | the current bar per the brief; decision: none of the "sparkle everything" cues survive — this app's composer already states its modes as labelled chips (`InputBar.tsx:124–127`), mobile keeps labels over icons-alone |

*Links + screenshots captured into this file in R2 when external browsing is
available in the pipeline; the decisions above bind regardless, sourced from the
repo's own shipped patterns + the brief.*

## Awwwards — craft rules taken (brief §9 list, per-screen consequences)

- **One idea, room to breathe** → Home: the composer is the hero; recents are
  secondary at 40 % of its visual weight. Quiz: question owns the screen (already
  one-per-screen on desktop `QuizPlay.tsx`).
- **Motion as explanation** → the transition set in `06` §3 (every named flow has
  a source-of-origin animation; none has decoration).
- **Editorial type on a phone** → Display role used once per screen maximum
  (`02`); everything else Body/Callout. Desktop's `letterSpacing: -0.02em` hero
  habit (`StepHeader`, PerformanceTab) is the voice to keep.
- Named winners the brief cites (WISPR FLOW, AP Transit, miralife.app, Charmling,
  Serus, Crow): studied for *momentum legibility*, *dense-data legibility at small
  size*, *restraint*; **rejected for this app**: cursor effects, scroll-jack, 12 s
  intros (already anti-patterns 3/7/etc.).
- Reader density: one column, 68 ch, generous line-height — no multi-column
  magazine layouts on a phone.

## Dribbble — component-level measurements taken

- Raised-centre pill dock above the home indicator, icon + 11 pt label, 64 pt bar —
  matches brief §9's stated pattern; the tab item is `Caption` label under 24–26
  icon, active state = label colour only, no second accent.
- Sheet headers: 36 pt grabber, 8 pt above title row, title `Headline`.
- Empty states: one line, one action, ≤ 120 pt tall. Skeletons: chip radius,
  6 % white sheen at 1.6 s (literally the repo's `.skeleton`).
- Card density: 12/14 pt padding, radius-card, hairline border, shadow only at
  elevation-3 surfaces.
- Chat bubble rule taken from the better ones, then broken where it matters:
  answers are *not* bubbles (document pages are) — the app's answers are prose to
  read, not SMS to scan; `Message.tsx` already reads as a block, not a bubble.

## Rejections (explicit, because the brief demands them)

Glassmorphism-everywhere; gradient text on body copy; five-tab bars; any second
accent colour (this app has one, `brand`, with `brand-2` confined to gradient
stops — enforced by the "one accent" lint); confetti beyond the existing quiz
moment (`lib/quiz/confetti.ts` — kept: it is earned, one-screen, reduced-motion
off); illustrations over 120 pt; custom cursors (there is no cursor); parallax.
