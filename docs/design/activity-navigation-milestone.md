# Approved roadmap: activity and navigation milestone

Implemented before the Liquid Glass/Board/Teams milestones. No release is being
prepared and no release notes/version bump were added for this work.

## Behaviour
- Collapsed More tools toggles a bounded, scrollable icon group inside the same
  60px rail. It does not call toggleSidebar. Its trigger position/orientation
  remains unchanged, and aria-expanded/aria-controls reflect its state.
- Expanded-rail More tools also keeps its chevron orientation fixed.
- Shared extractText intake reports real document operations (including PDF,
  DOCX and text intake from existing composer/library/quiz paths) in a separate
  transient job store, not by overwriting the single focus/streaming activity.
- Each operation has an ID, real page progress when available, error/cancel/ready
  state, and its own islandcn activity handle. No synthetic percentage/timer.
- Import activity temporarily exposes the island even if idle status is disabled;
  dismissing all import entries restores that preference. Existing user preference
  is never modified. Imports appear above the upload sheet; other activity keeps
  the normal layer. The sheet remains authoritative for saving an attachment.
- Multiple imports can be selected in the expanded view, including jobs outside
  the engine's two compact presentations. Terminal entries require explicit
  dismissal; active jobs cannot be dismissed without cancellation.
- File contents and activity metadata are not sent to any model. Ready means
  extraction finished, not that the user confirmed attachment/storage. Extraction
  progress is not an upload-to-server percentage. OCR is not added by this change.
- Activity glyph/value accents: cyan work, amber focus/cancellation, purple agents,
  green extraction success, red errors. Text labels still carry meaning.

## Verification
- TypeScript passed.
- Real-browser check-import-island.mjs passed: fixed trigger position/width,
  expanded state, actual PDF extraction from a valid fixture, invalid PDF recovery,
  already-aborted extraction, multiple entries and coloured errors, narrow overflow
  and explicit dismiss. No page errors. Desktop/narrow screenshots inspected.
- Narrow expanded content initially overflowed the engine's bounded geometry;
  constrained internal scrolling fixed unreachable actions and the real-click
  dismissal test passed without forcing clicks.
- Initial production build exited 137 with dev tools consuming sandbox memory.
  After stopping Vite, NODE_OPTIONS=--max-old-space-size=2304 npm run build passed
  (frontend 41.58s, backend passed). Existing chunk/import warnings remain.
- 12 BoardUI component checks passed. No physical/native WebView, screen-reader,
  very-large-PDF memory, or full desktop installer testing performed here.

## Boundaries and next work
Import indicators are transient, not a crash-recovery store. Teams journalling,
durable ACKs, attachments, encryption, offline sync and backups remain separate
approved work, not implied by this UI milestone. Cancellation is cooperative:
PDF worker is destroyed, while already-started browser file reads/DOCX work may
finish internally before the cancellation check suppresses the result.

Next: actual Glisse control adapters and the saved Liquid Glass Redesign
preference, followed by reviewed dithercn integration, standalone Board and the
remaining approved roadmap in docs/design/teams-roadmap.md.
