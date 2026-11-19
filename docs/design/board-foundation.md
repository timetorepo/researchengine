# Local Board — storage and first workspace checkpoint

Implementation progress, not a release note. The first local workspace is now available at /board (sidebar More tools → Board). This is not the complete Board milestone.

## Implemented

`frontend/src/lib/board/storage.ts` defines version-1 Board documents with stable UUIDs, revisions, viewport, typed item kinds and optional attachment/page provenance. Items have geometry, plain text, grouping and connector references, and drawing points. This is an extensible first schema, not a completed rich-text/drawing editor. No HTML rendering, fetching source URLs, provider calls or networking occurs here.

Native IndexedDB is used without a new dependency. Documents, immutable board-scoped Blob attachments and the previous committed document share one transaction. Save resolves after transaction completion, not after individual put requests. Expected revisions prevent stale windows silently overwriting changes. Each successful edit retains the previous snapshot; an explicit restore can save it as a new revision, retaining the latest document as the next recovery snapshot. Validation rejects unsupported versions, duplicate IDs, invalid geometry, missing linked items, cyclic groups and missing attachments without resetting existing data. Attachment IDs use composite IndexedDB keys, not delimiter-concatenated keys.

## Evidence

`tools/design/check-board-storage.mjs` runs against real Chromium IndexedDB in a disposable database and deletes that database afterwards. Passed:

- Save/reopen document, Blob and PDF page provenance.
- Monotonic revisions, unchanged caller data and board-list metadata.
- Previous snapshot and explicit restore as a new revision.
- Missing attachment abort rolls back both document and newly written Blob, preserving the prior recovery snapshot.
- Immutable attachments and board-scoped attachment lookup.
- Stale revision rejection and two open database connections racing: exactly one successful writer.
- Unknown schema, duplicate item IDs and cyclic groups fail validation.

The same browser script verifies the navigation accessibility follow-through documented separately. Glass/search browser regression suites, TypeScript, diff check and production frontend/backend build also passed.

## Honest limits and next work

Attachment import and selected-card image/PDF previews are implemented in the next checkpoint below. Next: direct card manipulation, attachment-complete backup/import and richer editing. Rich text, drawings, shapes, connectors and frames need actual editing tools; their schema presence is not delivered functionality. Board-to-session and mandatory model confirmation remain later work.

IndexedDB is browser-profile local. Storage eviction, user-cleared browser data, OS/hardware failure and private browsing can still lose data. A previous document is not an off-device backup, full operation journal, or crash-proof guarantee. Attachment deletion/garbage collection, full export/import backup and process-kill recovery tests are not implemented yet. Opening blocked storage reports an actionable error; per-tab draft quota failures are visible. Actual disk-full/native-device failure testing remains unperformed. Teams transactions, durable server acknowledgements, encryption, permissions, reconnect and collaboration are not implied by this local API. No security/encryption certification or native-device claim.

## First visible workspace

- Lazy /board and /board/:id routes, sidebar More tools entry and shell title; floating navigation hidden in this focused workspace.
- Searchable local board list with original static dithercn empty-state treatment; creating a board commits revision 1 before navigation.
- Opaque note/reference cards, controlled plain-text/annotation editor, http(s)-only explicit source links, searchable semantic outline and numeric position controls. Canvas scroll pans; zoom controls range from 50% to 200%. No hidden network fetch of references.
- Explicit Save revision, honest unsaved/saving/saved/error states, 100-entry in-memory undo and redo since the last save. Selection is shared between canvas and outline. Canvas text is a preview; the editor exposes full text.
- A per-tab sessionStorage recovery draft is written on edits. On return/reload, choose the draft or saved revision rather than silently replacing either. Draft-write failures keep text in memory and show a recovery warning. Closing the tab can lose this draft; browser beforeunload warning is only a best-effort aid while editing. Save before closing.
- Previous saved revision can be loaded into a draft, reviewed and committed as a new revision. The prior current revision remains recoverable. Stale drafts fail revision checks; download JSON before discarding/reloading if needed. Download draft is document JSON only, not an attachment-complete backup or a supported import workflow yet.
- Main and guest use separate IndexedDB database names and recovery keys. This is app-level separation, not host-blind encryption or a browser-origin security boundary. The existing wipe path deletes both Board databases and freezes Board writes in the wiping tab; versionchange closes other app-owned database connections. Blocked deletion is reported rather than called a success. No expansion of the older wipe path's guarantees for unrelated subsystems is claimed.

## Workspace verification

`tools/design/check-board-workspace.mjs` passed in an isolated Chromium context with API calls intercepted (not a provider integration test): create, note/reference edits, explicit save/reload, recovery draft, outline filtering/selection, positions, undo/redo, http(s) source gating, previous snapshot restore, zoom increments, 390px horizontal bounds, storage-pressure error injection, stale-writer UI retention, main/guest isolation, wipe database removal and write barrier. No page errors. Desktop, empty and narrow screenshots inspected. Storage, glass and settings-search browser suites also passed after a clean Vite restart. HMR mixed module instances initially invalidated the wipe barrier probe; clean startup tests passed.

TypeScript, production frontend/backend build, diff check and 12 BoardUI adapter tests pass. The historical r32 suite reports 374 pass / 5 fail: obsolete source assertions for CometDial, JellyRadio, two PatternWaves usages and default classic bubbles. Those five expectations already disagree with unchanged HEAD files (the current default is chat); they were not changed or suppressed here. Lock/wipe checks within that suite pass.

Not tested: screen reader, native installer, physical device, full browser-zoom/accessibility certification, real quota exhaustion, browser process-kill recovery or data eviction. Rich text, drawing/shapes/connectors/frames, full backup import, Board-to-session, Teams and collaboration remain future work; data schema alone does not deliver these tools.

## Attachment checkpoint

Board now has an explicit **Import & save files** action. It validates/decode-checks PDF, PNG, JPEG and WebP by content, then commits all new originals/cards and the current document draft in one transaction. The UI discloses that this saves the entire current draft. Validation failures/cancellation do not partially add cards, and failed commits retain the prior revision and existing in-memory draft. No arbitrary upload-MB cap; actual browser storage/memory limits still apply and are disclosed. Files are not uploaded or sent to providers.

One card is initially created for each original. A PDF card starts linked to page 1 and its inspector can select another valid page. The page number is persisted on the card, not inferred from text. Original Blobs are immutable and namespace/board scoped. The selected card alone loads/decode-renders a preview; other cards show file/page labels. This is not yet a gallery of canvas thumbnails or multi-page-card duplication. Image/PDF attachment labels can be annotated in the existing editor. Download original returns the saved bytes, while Download draft remains document JSON only (not a file-complete backup).

The installed pdf.js renders a bounded-resolution canvas, with selectable page text exposed in a disclosure. No PDF annotation/JavaScript/form/link execution UI or embedded browser PDF iframe. Eval/XFA/worker fetching are disabled in the Board loader. Scanned/blank pages remain previewable; missing selectable text is described honestly without claiming OCR. Password errors advise unlocking a copy; password handling was not independently tested with an encrypted fixture. Page-raster bounds (800×1000 target) are a preview resource limit, not an original-file size cap.

Validation progress counts actual completed files. Cancellation is cooperative across file reads/decode and aborts the IndexedDB commit if still pending. No timer-driven percentage. The existing extraction island's extraction-only semantics are unchanged; this Board-specific validation/save action reports its own inline status. Board originals are not given a misleading extraction-ready state. The store's optional AbortSignal also passed a transaction-abort test with no document or Blob leakage. Selecting another card releases image URLs/PDF resources; no eager whole-board PDF rasterization.

`tools/design/check-board-attachments.mjs` passed with real browser image decoding and a generated valid 3-page PDF: atomic image+PDF import including an unsaved note; actual image dimensions and non-white PDF pixels; page selection/text/blank-page feedback and reload persistence; byte-exact original download; malformed mixed-batch rollback; SVG rejection; deterministic cancellation while a real decode is held; guest isolation; 390px horizontal bounds; no page errors or external HTTP requests. Desktop and narrow preview screenshots inspected. Existing Board workspace/storage, glass and settings-search browser regressions, 16 adapter checks, TypeScript and production frontend/backend build passed.

Not a claim of antivirus scanning, sanitizing malicious PDFs, encrypted-at-rest storage, native-device memory measurements or exhaustive file-format compatibility. SVG/HTML/GIF/AVIF import is not supported in this slice. Browser quota eviction and closing an unsaved annotation draft can still lose data. Originals removed from cards are retained for previous-revision recovery until the existing app wipe; attachment GC, board deletion and full backup/restore still need implementation. Rich text, freehand/shape/connectors/frame tools, collaboration and Board-to-session remain pending. No version bump or release.
