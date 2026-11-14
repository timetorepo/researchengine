# BoardUI integration — implementation and evidence

## Status

All fourteen requested component types now have application consumers. This is a
product-specific BoardUI layout adaptation on the already-installed Base UI,
Motion, Lucide, HeroUI and Sonner infrastructure, not a second installed design
system or a claim that unchanged BoardUI components were dropped into the app.

The **60fps goal is not fully met in the measured cold-start scenario**. Warm
interaction results are near the 60Hz frame budget, but first settings open
still has substantial stalls in this headless environment. Do not describe this
work as certified 60fps on all devices.

## Source policy

Public reference repository: `https://github.com/BoardUI/boardui`, reviewed at
`ec5c5eb3e29c2441be63b9422cd54f411ef23466`, MIT, Copyright (c) 2026 Mertcan Dundar
Esmergul (BoardUI). Licence, source-reference hashes and adaptation notes live in
`frontend/src/components/ui/boardui`. About includes attribution.

Settings, upload, select, social connection button, notification center, date
picker and tree layouts were adapted to existing application data and installed
accessibility primitives. The tree has an original windowed renderer, the
upload replaces upstream simulated progress with local extraction, and the
select replaces upstream React Aria dependencies with already-declared Base UI.
These are not unchanged upstream implementations.

Accordion, overlay/drawer, popover and progress are original adapters following
publicly documented BoardUI anatomy. The public accordion registry was readable
through the page tool, but its extraction omitted JSX; incomplete extracted
source was not represented as a verified drop-in implementation.

Questionnaire and agent Task List are explicitly original equivalents of the
public Pro interactions; no paid source, private assets, credentials, telemetry
installer or new runtime dependency was used. Public source hashes identify
reviewed originals, not checksums of the adapted output. Pixel-level equivalence
to the hosted BoardUI previews is not established.

## Placements

| Component | Real consumer |
| --- | --- |
| Accordion | Marketplace tool descriptions, multiple expansion and keyboard controls |
| Date picker | Calendar event date selection with pending value, editable date, Cancel/Apply and date-only values |
| Drawer | Marketplace category filtering, draft state, Cancel/Clear/Apply and active count |
| File upload | Chat draft documents and local Library import; PDF/DOCX/TXT/Markdown intake |
| Notification | Existing application notice sink, BoardUI-style presentation on existing Sonner lifecycle |
| Popover | Token-estimate explanation; shared accessible portal adapter |
| Progress | Update settings, update-install circle, model downloads, setup checks, document extraction and existing shared operation-progress consumers |
| Select | Both shared ModernSelect and Watermelon Select entry points now delegate to one Base UI adapter; rich icons/hints retained |
| Social button | Marketplace connection state and existing sign-in actions; no invented authentication |
| Tree view | Coding project files, file opening/deletion, keyboard navigation, folder persistence; bounded DOM over large expanded trees |
| Notification center | Existing persisted local store, unread/category filters, Today/Earlier grouping, read/dismiss/navigation actions |
| Questionnaire | Existing ask_user tool, step navigation, single/multiple choices, free text, explicit submission, saved-answer review and stopped-run cancellation |
| Settings modal | Canonical modal for sidebar, shortcuts, contextual openSettings and legacy settings URLs; category search and all original tabs |
| Agent task list | Real queued/running/waiting/completed/failed/blocked/cancelled tool lifecycle, resource paths and measured elapsed time; user's editable Tasks panel is separate |

Icons are Lucide line glyphs in new application-owned UI. No emoji controls were
added. User-authored text and unrelated avatars/content were not rewritten.

## Data and accessibility details

- Settings retain original IDs, stores, defaults and independent save behaviour.
  Categories lazy-load. Direct settings URLs preserve the preceding route as
  background; contextual opens and shortcuts keep the current route. The modal
  owns focus, dismissal, modality and restoration through Base UI.
- The global shortcut handler no longer bounces settings Escape to Home or
  closes the underlying surface when a nested popover consumes Escape.
- Uploads have no arbitrary UI MB ceiling. Extraction stays local until the user
  chooses Library import or adds full extracted text to a draft; sending that
  draft to the selected model remains a separate action.
- The token figure is explicitly approximate, using extracted characters / 4,
  not a model-specific tokenizer or a claim about native PDF/vision billing.
  Other conversation/system/tool/output context is called out as additional.
  No silent document truncation: only the displayed preview is shortened.
- PDF.js parsing uses its worker; pages report actual extraction progress,
  processing yields between pages, cancellation tears down the PDF task and
  cleanup releases page resources. Scanned/no-text PDFs surface an OCR error.
- Unknown operation totals omit aria-valuenow and do not fabricate percentages.
- Tree rendering windows expanded trees above 200 visible logical nodes and
  renders at most 42 rows at once. Stable file IDs, roving focus, Home/End,
  arrows and typeahead support the windowed view.
- Pro-equivalent UI uses actual tool lifecycle events. There are no timer-driven
  fake task completions. Outstanding clarification/command approval waits are
  released on abort; stopped clarification cards cannot submit into a dead run.
- App and OS reduced motion suppress new transitions/spinners where applicable;
  dialogs use opaque surfaces, not animated full-surface blur.

## Verification completed

- TypeScript check: passed.
- Frontend/backend production build: passed. Existing dynamic-import,
  mixed-import and large-chunk warnings remain.
- `npm run boardui-test --workspace frontend`: 12 passed (progress semantics,
  questionnaire modes/cancellation/saved answers, task status and option parsing).
- `npm run kit-test --workspace frontend`: 15 passed, including shared select
  rendering and existing component SSR contracts.
- `npm run bots-test --workspace frontend`: 34 passed.
- `tools/design/check-boardui.mjs`: canonical modal category search, context
  return, contextual open/Escape and shortcut toggle; local text extraction,
  estimate disclosure and full draft insertion; nested popover Escape; actual
  local notification read; real ask_user pending promise/resume, multiple
  selections, step preservation and actual completion event; date Apply;
  narrow settings; failed/blocked/cancelled tool lifecycle; no page errors.
- `tools/design/check-boardui-data.mjs`: actual Marketplace routes against
  explicitly mocked service data; filter Cancel/Apply, portalled select, tool
  accordion, 1,000-file tree bounded DOM, End/Home/expand/open and persistence;
  no page errors.
- Existing settings, shell, workspace and Bencho browser regressions passed
  during this work. Workspace/Bencho tests now close the settings modal before
  interacting with the intentionally inert background; checks were not removed.
- Rendered desktop settings, submitted questionnaire/task log, date selection
  and narrow settings screenshots were inspected. Fixed search-icon overlap,
  duplicate category heading and legacy global modal-header style interference.

## Production performance evidence

Harness: `tools/design/measure-boardui.mjs`; ignored output under
`.cache/boardui-performance` includes a Chromium trace and JSON metrics.
Chromium 153.0.8010.0, headless sandbox, 1440x1000, production build, motion
enabled, no CPU throttling, explicitly mocked service data, 1,000-file fixture.
The sample includes input/action work and a 350ms tail. rAF intervals are a
regression indicator, not physical display FPS certification.

Latest measured run:

| Scenario | p95 frame interval | Frames >25ms | Long tasks >50ms |
| --- | ---: | ---: | ---: |
| Cold settings open | 150.0ms | 35 | 34 (maximum 169ms) |
| Profile tab | 16.7ms | 1 | 0 |
| Warm settings open/close | 16.7ms | 1 | 0 |
| Marketplace filter drawer | 16.7ms | 0 | 0 |
| 1,000-file tree keyboard scroll | 16.8ms | 1 | 0 |

Cold traces contain large GPU/commit events. This is evidence of a problem, not
proof that every stall comes from a particular new component. Cold-start
compositing and background/startup work need further isolation and comparison
on representative hardware before claiming the 60fps acceptance goal is met.

## Remaining limits

- Cold settings performance remains open as described above.
- No physical-device, real screen-reader, complete 200% browser zoom or
  cross-browser certification. 390px and existing 320px shell checks are browser
  emulation, not physical touch-device tests.
- Live OAuth/provider/CRM/model download/update installation were not exercised;
  seeded/mocked browser data is explicitly distinguished from those services.
- PDF worker code is integrated, but this new browser intake test uses local
  TXT, not a huge/encrypted/scanned-PDF fixture suite or a memory benchmark.
- Optional follow-ons from the proposal (Library's own filter drawer and Usage
  date-range aggregation) are not included; the requested drawer and date picker
  have actual Marketplace and Calendar consumers respectively.

No deployment was requested or performed.
