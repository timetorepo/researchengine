# 18 — Interactive answer cards and the coding task loop

Two features shipped together in this release:

1. **Interactive cards** inside an answer, in the spirit of Google's AI Mode: a
   comparison with tabs, a number the user can tune, options to pick from,
   a timeline, a bar chart.
2. **A Codex-style task loop** for coding turns, and a **project instruction
   file** (`AGENTS.md`) the agent reads on every task.

Both are built from HeroUI parts (`Card`, `Tabs`, `Slider`) and the app's own
buttons. Nothing in them runs model code.

## 1. Interactive cards

### What the model writes

The model adds one fenced block tagged `ui-card` holding one JSON object:

```json
{"title":"Compare","summary":"tune the numbers","blocks":[
  {"type":"stats","items":[{"label":"Monthly","value":"$12"}]},
  {"type":"slider","label":"Users","min":1,"max":100,"step":1,"value":10,"unit":"people"}
]}
```

The format is taught in `UI_CARD_PROMPT` (`frontend/src/lib/uicards/spec.ts`),
which `runChat` adds to every chat system prompt.

### Block types

| Type | Shape | What the user gets |
|---|---|---|
| `heading` | `text` | A small heading |
| `text` | `text` | A paragraph |
| `stats` | `items[{label,value,hint?}]` (≤6) | Metric tiles |
| `list` | `items[]` (≤12), `ordered?` | Bulleted or numbered list |
| `bars` | `title?`, `unit?`, `items[{label,value}]` (≤8) | Animated bars |
| `tabs` | `tabs[{label,text}]` (2–5) | HeroUI tabs |
| `choice` | `prompt?`, `options[{label,reply?}]` (2–6) | Pick one; a `reply` is sent as a message |
| `slider` | `label,min,max,step,value,unit?,note?` | A HeroUI slider with the live value |
| `timeline` | `items[{when,title,text?}]` (≤12) | A vertical timeline |
| `link` | `label,href` | An https link, opened in a new tab |
| `ask` | `label,prompt` | A button that sends a follow-up question |

### Safety rules

`parseUiCard` never throws. It enforces these limits:

- At most **10 blocks** per card. Unknown block types are dropped.
- Strings are clipped (text 600 characters, labels 80) and control characters removed.
- Links must be **https**. `http:`, `javascript:` and `data:` are dropped.
- Slider values are clamped to their range. A tabs block needs two tabs.
- The JSON is only data. React escapes every string, so a card cannot inject markup.

If the JSON does not parse (or is still streaming in), the block shows as a
normal code block, so no answer text is lost.

### Where it renders

`Markdown.tsx` checks each code fence. A `ui-card` fence that parses renders as
`UiCard` (`frontend/src/components/chat/UiCard.tsx`). Choice and `ask` buttons
dispatch the existing `re:send-prompt` event, the same path suggestion chips use,
so they never send anything without a click.

## 2. The coding task loop

### The loop

`CODEX_FLOW` (`frontend/src/lib/ide/codex-flow.ts`) is appended to the system
prompt of every project turn, after the house rules (`coding-rules.ts`):

1. Restate the request in one line. Ask one question only if the answer changes the work.
2. Look before changing: find and name the files involved.
3. Plan in at most five steps, and tick them off.
4. Make the smallest change, in the project's style.
5. Prove it with the project's own checks, and report only what was seen.
6. Finish with the headings **Changed**, **Verified**, **Not verified**, **Next**.

Destructive commands need the user's approval first.

### Intents

The agent panel's intent picker has four modes:

| Intent | Edits files? | Purpose |
|---|---|---|
| Fix | Yes | Find the root cause, fix it, prove it |
| Build | Yes | Implement a feature end to end |
| Refine | Yes | Improve clarity and structure without changing behaviour |
| **Review** | **No** | Critique with `path:line` findings, most serious first |

### Project instructions (`AGENTS.md`)

- A new project gets an `AGENTS.md` written from a template with four sections:
  Goal, Commands, Conventions, Done means.
- On every project turn, `runChat` loads `AGENTS.md` from the project root
  (`GET /api/ide/file`). The content is clipped to **4,000 characters**, passed
  through the outbound privacy shield, and added to the system prompt as
  user-written rules.
- A missing, unreadable or non-text file is ignored. It never blocks a turn.

## Tests

| Script | Covers |
|---|---|
| `ui-card-test` | Parser: known and unknown blocks, refusals, https-only links, clipping, caps, slider clamping, prompt coverage |
| `ui-card-render-test` | Renders every block type to HTML (no browser) |
| `codex-flow-test` | Loop and report order, review is read-only, template sections, `AGENTS.md` loading, clipping, failure handling |

Run them with `npm run <script> --workspace frontend`.

## Not covered yet

- The cards are checked as HTML, not in a live browser. Motion, focus order and
  the slider's drag feel still need a manual pass.
- The intent picker and the Codex-style flow have no end-to-end test against a
  live model.
- Only `AGENTS.md` at the project root is read. Nested files are not.
