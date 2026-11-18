# Local Board foundation — storage checkpoint

Implementation progress, not a release note. This is not yet a visible Board workspace.

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

Not yet connected to a route/UI. Next: Board list and note/reference canvas, keyboard-accessible outline, deliberate save/error/recovery feedback, then pan/zoom/history and attachment import/rendering. Rich text, drawings, shapes, connectors and frames need actual editing tools; their schema presence is not delivered functionality. Board-to-session and mandatory model confirmation remain later work.

IndexedDB is browser-profile local. Storage eviction, user-cleared browser data, OS/hardware failure and private browsing can still lose data. A previous document is not an off-device backup, full operation journal, or crash-proof guarantee. Attachment deletion/garbage collection, export/import backup, quota UI, blocked upgrade handling and process-kill recovery tests are not implemented yet. Teams transactions, durable server acknowledgements, encryption, permissions, reconnect and collaboration are not implied by this local API. No security/encryption certification or native-device claim.
