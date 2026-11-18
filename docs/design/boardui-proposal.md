# BoardUI integration proposal

Status: proposed; awaiting approval before application UI changes.

## 1. Direction

- **Product:** a local-first research and coding workbench, with providers and services connected only when the user chooses.
- **Character:** calm, exact, responsive.
- **World:** warm graphite work surfaces, organised like a technical workspace rather than a marketing dashboard.
- **Moments:** useful document/context previews and live agent activity, not decorative animation on every control.
- **Signature:** consistent line icons and explicit local/provider status alongside important actions.

Keep the existing warm-grey themes, compact preference, configurable glass and structural layout presets. Do not pick a new typeface during this work. Use Lucide icons instead of emoji in application-owned controls touched by the migration; preserve user-authored content. Service brands may use licensed brand SVGs where a generic icon would be misleading. Icon-only buttons need accessible names.

Applied project skills: Unslop for spacing and restrained chrome; Apple Design for direct feedback and interruptible overlays; Impeccable for accessibility/state coverage; Animation Performance for main-thread and compositing costs; Pick UI Library for avoiding a second competing runtime component system. Notification guidance informs deduplication and lifecycle, not an automatic Sonner migration.

## 2. Source and library policy

Reviewed BoardUI's public repository at `ec5c5eb3e29c2441be63b9422cd54f411ef23466`. Its root licence is MIT, Copyright (c) 2026 Mertcan Dundar Esmergul (BoardUI). Public files exist for settings, uploads, selects, tree view, notification and notification center. Availability of each remaining component must be checked individually before vendoring; a documentation page alone is not proof that its source is available under the repository licence.

Use actual freely available BoardUI source where verified, retaining licence, pinned provenance and attribution. Adapt tokens and icons to Research Engine. No blind `npx ...@latest` installers. The public source uses React Aria, Remix icons and BoardUI-specific foundations; first audit already-installed accessibility packages and reuse HeroUI/Motion where compatible. Any necessary new runtime dependency will be proposed explicitly rather than silently installed.

Questionnaire and Task List are explicitly Pro on their public documentation pages. Implement original equivalents with closely matching publicly observable interaction and layout, without retrieving paid source, private assets or a licence key. Label them as Research Engine implementations, not official BoardUI Pro components. Public textual review has established behaviour, not pixel-level visual equivalence; inspect public rendered previews before claiming visual fidelity.

## 3. Component placements

| Requested component | Placement and behaviour |
| --- | --- |
| Accordion | Marketplace app/tool sections and custom-service details. Preserve actual tool descriptions, connection state and multi-expand behaviour; reveal tool bodies on demand. Keyboard-operable headings with expanded state. |
| Date Picker | Calendar event date selection first. Reuse for a real Usage date-range filter after wiring aggregation to the selected range. Date-only values remain calendar dates rather than accidental UTC conversions; scheduling uses the explicit timezone. |
| Drawer | Marketplace filters first, then Library filters using the same primitive. Desktop side drawer; full-width sheet on narrow screens. Draft changes with Apply, Cancel and Clear; active-filter count outside the drawer. |
| File Upload | Shared document intake in chat and Library. Drop zone, keyboard file picker, per-file processing/cancel/error states and a context estimate before sending. No arbitrary UI MB ceiling. |
| Notification | Brief feedback for user-triggered save, copy/export, upload processing, connection and update outcomes. Inline errors stay beside the failing control; no toast for every keystroke or routine background event. |
| Popover | Attachment/context details: extracted pages, token estimate method and selected-model context budget. Also reusable for compact contextual actions. Portalled and viewport-clamped, with keyboard dismissal and focus restoration. |
| Progress | A shared progress presentation for updates, document processing and other genuine operations. Preserve the existing update card, release notes and restart guidance. Determinate only when totals are known; indeterminate otherwise. |
| Select | Shared single-/multi-select styling for ordinary settings and filters. Preserve native forms and accessible semantics. Model/provider search remains a searchable combobox, not a giant unsearchable select. Migrate consumers in audited groups rather than global search-and-replace. |
| Social Button | Marketplace/provider connection actions backed by existing authentication/configuration flows. Show Connect, Connecting, Connected, Reconnect or Disconnect truthfully. Never imply OAuth exists where only API-key setup is supported. |
| Tree View | Coding workspace file explorer. Real workspace data, file opening, expanded-folder persistence, file-type icons, active file and existing context-menu actions. Lazy-load branches where supported; render only visible rows for large trees. |
| Notification Center | Replace the existing bell panel, retaining its local notification store. All/Unread and meaningful existing categories, grouped by time, mark read/all read, dismiss and actual destination actions. No sample mentions or invented collaboration activity. |
| Questionnaire — original equivalent | Inline AI clarification cards in research/coding conversations. Single/multiple choices, optional Other, step navigation, answer review and explicit Send answers. Associate answers with the originating turn; never submit merely because a visual timer elapsed. |
| Settings Modal | One canonical settings dialog replacing the separate page/sheet presentations. Desktop two-column modal with grouped category rail, search, close control and a scrollable content pane. On narrow screens, full-screen dialog with category navigation. Retain every setting and its saved value. |
| Task List — original equivalent | Live AI/tool execution log inside the originating conversation turn, not a replacement for the user's editable Tasks panel. Queued/running/completed/failed/cancelled states, real resource chips and expandable detail. Completed groups may collapse without hiding failures. |

## 4. Settings revamp details

Use the existing tab registry and settings stores as the source of truth. Reorganise presentation, not persistence schemas unnecessarily. Group Profile/Appearance/Workspace, Models & AI, Connections, Privacy & Data, Notifications and About/Updates, while keeping advanced settings reachable and searchable.

Sidebar Settings, keyboard shortcut, contextual settings links and legacy `#/settings` navigation must open the same modal. Preserve the underlying chat/project and scroll position. Closing returns focus to the opener; direct-entry routes get a predictable fallback. Back/forward must not leave an invisible modal route or bounce the user to Home unexpectedly.

Lazy-load tab contents, not every settings page at opening. Use an accessible dialog primitive with focus containment, background inertness, body-scroll locking, Escape dismissal and correct nested popover/dialog ordering. Preserve current immediate-save behaviour where applicable; do not add a fake global Save button to settings that already persist independently.

## 5. Local uploads and token estimates

Local does not mean unlimited memory or unlimited model context. Remove arbitrary marketing-style MB limits from the UI, but retain truthful warnings for browser memory, actual backend/provider constraints and model context capacity. Never silently truncate a document.

Pipeline:

1. Select files locally and show name/type/size immediately.
2. Extract supported document text using the existing document pipeline; PDF.js already has a parsing worker.
3. Report extraction progress as pages processed when the total is known. Add cancellation, cleanup and bounded concurrency; yield/chunk remaining text aggregation or token work so parsing does not monopolise rendering.
4. Count tokens from the exact text that will be included. Prefer a compatible local tokenizer when already available; otherwise show a clearly labelled estimate with its method, not an exact count.
5. Separate **document tokens** from **total prompt context**: conversation, system instructions, tool schemas and reserved output also consume capacity.
6. If retrieval sends selected chunks, show full extracted size separately from estimated chunks actually sent. Do not imply the model sees the full PDF.
7. Scanned PDFs show that OCR is required; no invented token estimate. Native PDF/vision ingestion has provider-specific accounting and must be labelled separately from extracted-text estimates.
8. Local extraction stays local. Sending to a remote model remains a separate explicit action with the selected provider identified.

## 6. Technical plan for a 60fps target

60fps allows roughly 16.7ms per frame; 120Hz allows roughly 8.3ms. These are budgets, not a promise across every device or document size.

### Motion

- Animate overlay translation/opacity and small icon transforms, usually about 160–220ms. No artificial delay before an action starts.
- Avoid animated backdrop blur, large shadows, full-page filters and `transition: all`. Keep glass static and bounded; supply opaque/reduced-transparency surfaces.
- Accordion height changes genuinely affect layout. Use a short measured transition only for small sections; large tool groups open without a costly full-subtree height animation. Fade small inner content rather than scaling text.
- Progress fill uses `scaleX` with a fixed track and start-edge transform origin. Unknown progress never becomes a fabricated percentage.
- Respect both OS and application reduced-motion preferences. No continuous animation when panels are closed, offscreen or the document is hidden.

### Rendering and data

- Subscribe to narrow store slices. Opening a select must not rerender the conversation or workspace tree.
- No React state update on every animation frame. Use CSS/WAAPI or existing Motion values for motion; React handles semantic state transitions.
- Batch stream events and progress display updates independently from actual data ingestion. Record all real events without rendering the entire growing log on every token.
- Flatten only expanded tree branches; window large visible-row lists, preserve stable IDs and keyboard focus. Apply the same bounded rendering principle to large notification and tool lists.
- Lazy-load calendars, modal tabs and document parsers. Cancel obsolete requests and revoke object URLs/worker resources on disposal.
- Keep expensive extraction/token counting off the interaction-critical path. An async function alone does not make CPU work non-blocking.

### Measurement

Capture production-build browser traces for settings open/tab change, filter drawer, marketplace expansion, large file tree scrolling, notification center, streamed task updates and PDF extraction while interacting. Record frame intervals/dropped-frame behaviour, long tasks, input responsiveness, DOM size and React commits using fixed fixtures and repeatable runs.

Target: interactions stay near the display's refresh cadence on the tested baseline, with no recurring UI-caused >50ms main-thread tasks during those interactions. Report fixture size, browser, viewport and environment; report p95 frame intervals and long-task counts rather than an unsupported '60fps everywhere' claim. Headless sandbox results are useful regression evidence, not physical-phone certification. Verify representative real hardware separately when available.

## 7. Build order and acceptance

1. **Source + foundations:** verify each free source/licence, record provenance, bridge tokens/icons, establish select/popover/progress/overlay adapters. No second theme engine.
2. **Settings:** build the canonical modal and migrate all entry points while preserving every tab and preference.
3. **Marketplace:** accordion, connection buttons and filter drawer, then shared notification presentation/center.
4. **Documents + dates:** shared intake with honest token/context accounting; calendar picker and real date filtering.
5. **Coding + AI:** file tree, validated questionnaire message contract and real event-driven task log. Ordinary prose questions retain a usable text-answer fallback; no brittle text guessing that invents structured questions.
6. **Verification:** TypeScript, production build, relevant logic tests and rendered browser checks. Cover keyboard/focus/Escape, reduced motion/transparency, 320/390px windows, 200% zoom, long text and empty/loading/error/populated states. Test persisted settings and return-to-context navigation. Keep screenshots/traces in ignored storage, document evidence and commit per feature with the required co-author.

No fake connections, fake progress, fake task completion or sample notifications ship. No deployment is part of this proposal. Any source not freely available is disclosed and replaced only with an explicitly identified original implementation.

## Approval

Approve this proposal to begin the implementation phases above. Repository guidance requires proposal approval before changing application UI; no application changes have been made for this request yet.
