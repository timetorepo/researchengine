# Approved collaboration and product roadmap

User approved the proposal and recommended host-trusted encryption approach.
Implementation proceeds in testable milestones; this is not a release note.

1. Collapsed-rail More tools without expanding/rotating/repositioning trigger;
   real document-import island activities and meaningful coloured accents.
2. Saved opt-in Liquid Glass Redesign using real Glisse components, with a
   processing-cost warning, reading-surface stability and accessible fallbacks;
   selectively reviewed dithercn static/image/progress treatments.
3. One standalone local Board with references, notes, drawing/annotation,
   attachment provenance, persistence and recovery; collaboration-ready data IDs.
4. Board-to-session snapshot, intent/context preview and mandatory explicit model
   choice/confirmation before any provider call; no silent context truncation.
5. Replace active Council UI with original bounded leader/specialist/reviewer
   MultiAgent orchestration; keep provider-native effort separate, preserve old
   chats, track cost/limits, evidence/disagreement and whole-run cancellation.
6. Teams host/join, LAN/self-hosted HTTPS first; expiring/revocable invitations,
   per-request roles and strict separation from private local resources. Internet
   short codes require an explicit rendezvous design, not silent tunnelling.
7. Collaborative Board and Teams-only BackChat with linked objects, durable
   operations, reconnect queues and recovery tests. TLS plus encryption at rest
   initially; authorised host can read plaintext. Do not claim host-blind E2EE.
8. Replace website presentation using real app screenshots/components and an
   isolated labelled demo, oil-painted framing, verified art/gradient licences,
   accurate privacy/branding pages and free MIT pricing with API/hosting caveats.

New collaboration dependencies and artwork licences need specific review.
Do not copy gated templates or proprietary Perplexity source/branding. Do not
invent provider models, progress, metrics, multi-agent correctness or security
certification. Teams crash durability must precede public remote access; durable
ACKs, local pending queues, atomic attachments, journal/snapshot and backup tests.

Release notes are written only when a release is approaching. Milestone progress
belongs in design/engineering documentation, not speculative release notes.

## Offline journal checkpoint — 2026-11-12

`backend/src/teams/journal.ts` is an isolated, unregistered storage primitive;
there are no Teams routes, UI, listeners or access to private local resources.
It does not authorize operations: the future service must authenticate actors,
enforce roles and validate typed Board/BackChat operations before append.

The journal serializes immutable JSON operations with ordered sequences,
previous-record hashes and unique operation IDs. Identical retries return the
original receipt; reuse of an ID with different content is rejected. Each record
is AES-256-GCM encrypted/authenticated using a fresh random nonce. The caller
must supply an independently generated **journal-specific**, separately protected
32-byte key. No persistent key management is implemented and no key is stored
in the journal. This is host-trusted encryption, not host-blind E2EE.

The file and newly created journal directory request owner-only permissions.
The caller must supply a trusted, local, private parent directory (not an
attacker-controlled path or shared/network filesystem). File and directory
sync must succeed before opening; append receipts resolve only after file sync.
An append/flush error poisons the handle: no acknowledgement and no further
writes until close/recovery. An unacknowledged record can still survive; clients
must retry the same operation ID, never invent a new ID after a timeout.

Replay authenticates every complete record and checks sequence/hash/identity.
A non-newline-terminated tail is treated as an incomplete unacknowledged write
and truncated with sync. Complete corrupt/unknown-version records fail closed
without clearing the log. Hash chaining detects internal reorder/removal but
**does not detect removal of a valid suffix or whole-log rollback** without a
separately trusted checkpoint. There is no rollback/security certification.
Journal replay currently loads the entire log in memory; compaction/snapshots,
size/DoS policy and large-log performance are future work.

A single-writer exclusive lock prevents cooperative concurrent opens. A crash
leaves the lock in place; it is never automatically stolen based on PID or age.
Recovery presently requires an operator to stop/verify all writers offline,
preserve a backup, then remove only that journal's `writer.lock` before opening.
This is an engineering primitive, not a finished recovery UX/CLI. It assumes
local filesystem fsync semantics; hardware power-loss/network-volume/Windows
behavior is not certified. Existing permissive directory modes are not repaired.

Verification: `tsx backend/scripts/teams-journal-test.ts` passes 11 grouped checks:
exclusive writer, ciphertext/no plaintext marker and file permissions,
clone-before-queue/idempotence/conflict refusal, concurrent sequencing,
immutable replay/close drain, wrong-key refusal without log changes, incomplete
tail recovery, tamper/reorder refusal, invalid JSON, injected flush failure with
no receipt/poisoned-handle recovery, and a real OS SIGKILL after durable receipt
followed by offline lock clearance/replay/idempotent retry. Backend TypeScript
and production build pass. No provider calls or networking; no UI changes to
render. Snapshots, atomic attachment storage, full backup verification and
persisted client pending/reconnect queues remain required before networking.
Key protection, rotation and recovery policy also remain required before use.
