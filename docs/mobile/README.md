# docs/mobile — Research Engine on phones: the design documentation

Thirteen documents from the port brief (Part 8) plus the parity matrix. Numbers,
not adjectives. Where a number is verified in code, the file is cited. Where a
number is a gate the brief imposes, it is marked **[gate]**. Where neither exists
yet, the value says TBD and names the round that decides it — never invented.

Status: R1 skeleton, written 2026-10-03 against checkout `0.16.0-beta.1`.
Read `parity-matrix.md` first; it corrects several premises in the brief that
this checkout does not support.

| File | Contents | Status |
|---|---|---|
| `00-principles.md` | Five principles, each with a therefore-do / therefore-do-not pair | R1 |
| `01-tokens.md` | Token table with the real values from `themes/meta.ts` + `globals.css`; the mapping into `packages/tokens/tokens.json` | R1 |
| `02-type.md` | Type scale in sp/pt, Dynamic Type behaviour, roles | R1 |
| `03-grid-and-layout.md` | Grid, safe areas, reach map, landscape, foldables | R1 |
| `04-navigation.md` | Tab bar, sheet detents, push depth, deep links, back, route diagram | R1 |
| `05-components.md` | Component specs — inventory seeded from the 85 real component files | grows R1→R8 |
| `06-motion.md` | Durations/curves as actually shipped on desktop, plus the mobile [gate] ladder | R1, completes R8 |
| `07-haptics-and-sound.md` | Event → pattern table; sound policy | R1 |
| `08-accessibility.md` | Labels, contrast, 200% text, switch control, acceptance list | R1, gate in R8 |
| `09-states.md` | Empty / loading / error / offline / unpaired / permission states with copy | R1, copy completes R7 |
| `10-performance.md` | The frame contract, quality ladder, device floor, benchmark scenes | R1; numbers live R3, R8 |
| `11-latency.md` | The 10 ms / 200 ms tiers and which operation is which | R1; enforced R2–R3 |
| `12-platform-differences.md` | The iOS/Android table | R1, lives open |
| `13-references.md` | Refero / Awwwards / Dribbble study — patterns taken, patterns rejected | R1 structure, completed R8 |
| `parity-matrix.md` | Deliverable 1 of the kickoff: every feature, its placement, and the real paths | done (R1) |
| `security.md` | Every dependency that touches the network and what it can see | R1 |
| `screens/` | One spec per screen (brief §7.3), starts R1, completes R4–R7 | per round |

Rules the whole folder obeys:

1. A number in these documents is either (a) read from a file, (b) a gate the brief
   imposes, or (c) TBD with a named owner-round. No fourth kind.
2. If the build and a document disagree, the document is wrong — fix the document
   in the round that changed the build. R8's acceptance is literally
   "the docs describe what actually shipped".
3. Copy rules apply to these documents and to every string they specify: plain,
   specific, honest. No "seamlessly", no "unleash", no em dashes in user-facing
   strings.
