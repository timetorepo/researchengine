# Shared draft canvas and multi-user validation

Working branch, 2026-11-12. Not a release, deployment, or production stability certification.

## Delivered in this continuation

Shared Board drafts now use the existing BoardCard/connector/drawing controls instead of blocking all non-note Boards. This view never opens local Board IndexedDB and never automatically uploads a private Board.

- Scroll-to-pan canvas and local zoom controls.
- Pointer and keyboard move/resize handles; explicit geometry inspector.
- Notes, references with validated HTTP(S) source URLs, shapes (rectangle/ellipse/diamond), frames, freehand strokes with a keyboard coordinate alternative, and connector creation/endpoints/labels.
- Frame membership and group-aware moves; endpoint deletion removes incident connections.
- Text/plain-Markdown choice, selected-item text editing, deletion confirmation.
- Bounded 50-step canvas undo and redo, separate from host history. Canvas undo does not roll back a published revision. Existing title/plain-text draft controls are outside this canvas-only history.
- Existing image/PDF items can retain their identity, geometry, text/provenance and attachment references. Original uploads/downloads/previews are **not yet integrated**. They are not represented as functioning previews.
- Draft edits clear publication consent; Viewer sessions cannot edit. Uncertain sends freeze editing; publication still uses the loaded expected revision and existing encrypted draft recovery.

This is a shared draft canvas with whole-document compare-and-swap, not a CRDT, per-item merge, live-cursor/presence, automatic sync or complete collaborative product. The UI must not claim those capabilities. Existing snapshots and drafts remain distinct; no unapproved autonomous writes.

## Reproducible checks

```
npm run teams-managed-test --workspace backend
LD_LIBRARY_PATH=$PWD/.cache/native-browser/libs/lib BROWSER_EXECUTABLE=/tmp/chromium node tools/design/check-teams-boards.mjs
LD_LIBRARY_PATH=$PWD/.cache/native-browser/libs/lib BROWSER_EXECUTABLE=/tmp/chromium node tools/design/check-teams-connection.mjs
npm run teams-test --workspace backend
npx tsc --noEmit -p frontend/tsconfig.json
npx tsc --noEmit -p backend/tsconfig.json
```

The native-browser paths above describe this sandbox, not portable installation requirements.

### Concurrent-user transport scenario — real loopback TLS

Two independent authenticated principals (Owner and Editor) load the same canvas and race to publish different text/geometry at the same expected revision. Repeat for 10 rounds. Each round asserts exactly one ACK, exactly one HTTP 409 conflict, and identical Boards observed by both clients after explicit refresh.

Latest measured run:

| Check | Result |
|---|---|
| Concurrent rounds / attempted revisions | 10 / 20 |
| ACKs / conflicts | 10 / 10 |
| Divergent snapshots after refresh | 0 |
| Round durations (ms) | 18, 12, 19, 14, 14, 11, 12, 11, 12, 16 |
| Response discarded after a real host commit | Client observes uncertainty; explicit read finds committed next revision |
| Injected offline read | Fails; original connected clients subsequently read matching state |
| Injected 120 ms transport delay | Read succeeds after delay |
| 30 ms request timeout against delayed transport | Aborts with timeout; no automatic retry |
| CLI SIGTERM drain/restart and writer-lock checks | Pass |

The test uses a disposable CA with certificate verification enabled, ephemeral loopback listener and temporary encrypted storage. It is not a multi-browser human usability study. Delay/disconnect/response loss are injected around the transport; this is not packet-level network emulation. No real Wi-Fi/mobile/public host was tested, no soak test or peak capacity was measured, and these small timing samples are not an SLA.

**Conclusion:** the tested snapshot protocol retains conflict safety and convergence after explicit refresh under these bounded conditions. It cannot establish that arbitrary connections are stable enough for live canvas collaboration. In fact, competing whole-document edits intentionally conflict frequently (one rejection per round). Low-friction simultaneous editing needs a separately verified merge/rebase or finer-grained operation design, plus attachment transport and reconnect/outbox integration.

### Browser application scenario — intercepted host transport

Verified consent reset; creation and publication; conflict retains draft; explicit discard/latest-base selection; uncertain commit reconciliation without resend; encrypted pending export/restore; Viewer gating; and 1440/390/320 and CSS-200% containment. New canvas coverage edits a shape, geometry, undo/redo, reference source, frame, coordinate-based stroke and connector before publishing their exact payload. Existing local Board controls are reused; this is not exhaustive shared pointer/pen/touch or screen-reader coverage. Full build/typechecks and Teams/BackChat regression checks are separate gates.

## Remaining, explicitly not completed

Attachment transfer and rendering, automatic durable outbox/reconnect, live collaborative merge/presence, full keyboard/screen-reader/device review, large-canvas performance and long-running real-network fault testing. Website remains on hold for proposal review. Final release notes and deployment have not been authorized or prepared as a shipped release.

## Rust scraper request

The repo already contains hosted/self-hosted Firecrawl API search support. The requested local Rust executable has not been identified by an authoritative user-supplied repository/executable/version. Repository inspection found `firecrawl/firecrawl` and a separate third-party Rust rewrite; neither is assumed interchangeable. No binary was downloaded, installed or executed. Await the exact upstream project before defining its CLI contract, pinning source/checksums, reviewing licensing/security, and adding bounded execution/cancellation/output handling and tests. This item is blocked, not delivered.

## Explicit disjoint-edit merge preview continuation

When a conflict is refreshed and the original selected base is still held in the same tab, **Preview disjoint canvas merge** offers a conservative three-way whole-item merge. It compares base, draft and latest loaded snapshot by stable item ID. Changes to different items and one-sided title changes can be combined; competing same-item edits, delete-versus-edit, competing titles and invalid connector/frame relationships remain conflicts. Even different fields on the same item deliberately conflict. Ordering follows latest host items plus draft-only additions; it is not a collaborative z-order protocol.

A successful preview changes only the local draft, adopts the latest loaded expected revision, clears consent and requires explicit review/publication. It does not make a request. A new concurrent change can still cause the eventual CAS publication to conflict. Imported drafts without an original base cannot invoke this merge; they retain manual comparison/recovery. No forced overwrite, autonomous rebase or silent conflict resolution is offered.

Pure tests cover disjoint edits, same-item/title/delete-edit conflicts, invalid relationships, scope/revision gates and unchanged inputs. Browser tests preview a draft note change alongside another member's title change, verify both survive, consent is off and operation count is unchanged. The real disposable-CA TLS suite also publishes a separately reviewed merged result combining Owner and Editor edits to different items. Live merge/presence, attachment originals, durable automatic outbox/reconnect, real-network soak and exhaustive device/a11y tests remain unfinished.

The Firecrawl Local identity question is now resolved by the supplied official quickstart; see `firecrawl-local.md` for the delivered adapter and its outstanding official-binary live verification. The earlier blocked-on-project-identification paragraph is historical, not the current status.
