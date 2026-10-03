# 05 — Components

Spec table per component: purpose, anatomy, sizes, states
(default/pressed/loading/disabled/error), tokens, haptics, copy rules, screens.
This file R1 does two things: fixes the shared spec-table format, and seeds the
inventory against the 85 real component files so nothing gets "designed" that the
app doesn't have, and nothing shipped has no row.

**Format (every row below expands to this in R2–R7):**

| field | content |
|---|---|
| Purpose | one sentence, names the job per brief §7.1 ("one job, named in the file") |
| Anatomy | parts in z-order, safe-area behaviour |
| Sizes | fixed measurements on the 4 pt grid |
| States | default / pressed / loading / disabled / error — each with the copy it shows |
| Tokens | exact names from `01-tokens.md` |
| Haptics | event → pattern from `07` |
| Copy rules | forbidden phrasings for this component |
| Appears on | screen list |
| Desktop ancestor | the file(s) in this repo it descends from (keeps the port honest about drift) |

## Inventory (seeded, R1)

| Mobile component | Desktop ancestor (this repo) | Mobile-specific spec |
|---|---|---|
| TabBar (3 + raised Ask) | `topbar/TopBar.tsx`, `os/OSDock.tsx` | height 64+inset; pressed state only (no hover); Ask uses `grad-flood`-adjacent solid brand circle 56 |
| Sheet (detents) | `ui/heroui/Button/Input/Switch` primitives + modal patterns; `settings/SettingsSheet.tsx` | grabber 36×4, radius-modal 24 top-only |
| Composer | `input/InputBar.tsx` (mode chips, 3-image limit, `/` skills, `@` sources) | same capability set, chips become a mode row inside the sheet; send button gets touch-down haptic |
| AnswerBlock | `chat/Message.tsx` + `chat/Markdown.tsx` | incremental render per brief §5.1; long-press action row replaces icon row on hover |
| CitationChip | `chat/SourceStrip.tsx` | number-only `[n]` chip 22×min; tap opens source sheet, no hover tooltip exists on mobile |
| SourceSheet | (desktop = inline reading) | new; page preview + "open in browser" + "save to citations" |
| ToolCallCard | `chat/Message.tsx` toolTrace chips, `chat/ToolUI.tsx`, questionnaires + `pendingExec` in `lib/chat/tools.ts` | statuses `ok|error|blocked|confirm` exist in types; confirm is the approval gate UI, must read like a gate, not a toast |
| FlowStages / ThinkingOrb | `chat/ThinkingIndicator.tsx`, `.re-orb` CSS, `shared/ThinkingOrb.tsx`, `flow/engine.ts` STAGE_LABELS | labels are the contract ("Understanding your question" …); orb static at Lean, none at Minimum (label stays — `00` principle 3) |
| QuizCard | `quiz/QuizPlay.tsx` (6 types), streak pill, timer ring | one question per screen; answer buttons ≥ 52 pt; `fill-correct` sweep and `shake-x` exist in CSS, reused verbatim incl. reduced-motion handling |
| ReaderHighlight | `reader/ReaderView.tsx` (`renderWithHighlights`, tiers incl. `user` "Your highlight") | selection drag → handles (new); marker sweep = `.fill-sweep` idea at ≤10 ms tier-1 |
| NotebookRow / SpaceCard | `library/LibraryView.tsx` (spaces), `Space` type | scope pill always visible in chat ("Notebook: X", brief §7.3.7) |
| FolderRow / FileRow | `settings/IntegrationsTab.tsx` box rows, `connectors` list | per-item long-press; "not connected yet" copy per `09` |
| AgentRow (radio room) | `agents/FloodView.tsx` scratchpad lines, `pulse-dot` CSS | live per-agent status; scale banner "DEVICE SCALE — 2 agents / budget 8k" vs "COMPANION SCALE" |
| JobRow | (new; export/flood/transcript share the job queue) | progress + cancel after 2 s (`11` rule); pause/resume visible |
| ModelCard / ModelPicker | `topbar/TopBar.tsx` picker logic, `settings/ModelsTab.tsx` | grouped by provider, live list, refresh spinner has a sentence |
| ScopeRow | (new; companion) | per-scope toggle, second-confirmation explainer for `coding.exec` |
| Snackbar (toast) | `shared/Toasts.tsx` + `useUI.toast` | above tab bar, action slot, haptic class per `07` |
| Skeleton | `.skeleton` + `shimmer 1.6s`, `shared/RouteSkeleton.tsx` | skeleton not spinner is the rule (`09`); at Minimum shimmer freezes to static alpha |
| Snippet/CodeBlock | `chat/Markdown.tsx` code path, `--code-bg` | viewport-only highlighting (brief §5.1.5); copy button |
| PrivacyShieldControl | `sidebar/PrivacyPanel.tsx`, `lib/privacy/shield.ts` copy | three postures, current-state banner above composer when topsecret (it changes what search can do) |
| VoiceGlow (R7) | none in this checkout (parity-matrix row) | hold-to-talk; glow composited opacity, not blur |
| CommandSheet | `shared/CommandPalette.tsx`, `ShortcutsOverlay.tsx` | search-first; "Gestures and shortcuts" page replaces key list |
| LiveActivity tile (iOS) / timer notification (Android) | `os/DynamicIsland.tsx` focus mode | content = FocusPill 25/5 state machine (`shared/FocusPill.tsx`) |

## Global rules

- Every component consumes tokens only — no literal hex/px outside `01` names
  (CI check: regex on `#[0-9a-fA-F]{3,8}` inside `mobile/src/components/**`).
- Nothing may depend on hover (`00` principle 2); `:hover` in mobile CSS is a
  lint error except `@media (hover:hover)` tablet/pointer cases (R8 decision).
- Disabled is a last resort: if a control is disabled it carries a one-line why
  next to or under it — "no buttons greyed out with no explanation" is brief §4.3
  wording, applied to every component.
