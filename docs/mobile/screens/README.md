# docs/mobile/screens — one spec per screen (brief §7.3)

A screen spec is complete when another designer can build it without asking a
question: anatomy, measurements on the 4 pt grid, every state from
`../09-states.md` with copy, motion in/out from `../06-motion.md`, tier per
operation from `../11-latency.md`, and the file where it will live in `mobile/`.

| Spec | Status | Owner round |
|---|---|---|
| `home.md` | written R1 (shell exists) | R1, content rows grow R3 |
| `ask-sheet.md` | stub R1 → full R3 | R3 |
| `chat.md` | stub R1 → full R3 | R3 |
| `reader.md` | R4 | R4 |
| `quiz.md` | R4 | R4 |
| `library.md` | written R1 (sections fixed; data wiring R2) | R1/R2 |
| `notebooks.md` | R4 | R4 |
| `articles.md` | R4 | R4 |
| `flood.md` | R7 (radio-room view; scale banner per parity §1) | R7 |
| `workflows.md` | R7 | R7 |
| `coding-companion.md` | R7 | R7 |
| `you-settings.md` | written R1 (theme engine lives here) | R1 |
| `onboarding.md` | full rewrite of desktop's 5 steps onto mobile rules; brief assumed 8 — the port specs **four**: posture, provider-or-demo, theme, first question | R3 |
| `companion-pairing.md` | R6 | R6 |
| states | shared, in `../09-states.md` | — |

Stub rules until a screen's round: the file names the job, lists the §7.3 state
set, and says "not yet specified beyond the brief" — no fake measurements.
