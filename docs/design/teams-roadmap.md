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

## Immutable objects and snapshot-bundle checkpoint — 2026-11-12

`backend/src/teams/objects.ts` adds offline encrypted attachments, immutable
checkpoint snapshots and snapshot-bundle export/restore. Still no service,
routes, host/join, UI, networking or access to private chats. No dependency added.

Objects use AES-256-GCM with random nonces and team/type-specific authenticated
context. Content identities are keyed HMAC-SHA256, scoped to team and object
kind; filenames do not expose unkeyed plaintext hashes. The caller supplies a
separate team-object key (not the journal key). Keys are never persisted here;
protected key provisioning, lifetime/disposal, rotation, and operator recovery
remain unfinished. An authorized host can read plaintext: not host-blind E2EE.
Object size and same-team deduplication are visible on disk.

Publication writes owner-only temporary ciphertext, fsyncs it, then hard-links
it to the immutable content identity without replacing an existing object.
Directory sync precedes completion; temporary links are removed and synced.
Concurrent identical uploads verify and reuse the original ciphertext. Existing
corrupt objects fail closed, never silently overwrite/heal. Orphan temporary
files are ignored, not automatically deleted; offline cleanup/GC remains future
work. Failures after publication can leave a valid unacknowledged object; retry
is safe. This is local-filesystem hard-link/fsync behavior, not portable storage
certification or secure deletion. Filesystem failures/power loss at every
publication boundary are not exhaustively injected/tested.

Both journal and object creation now require an existing trusted private parent
and fsync it after creating the leaf directory; they do not recursively create
unsynced ancestors. Do not use attacker-controlled directories/symlinks or
network volumes. Existing directory permissions are not repaired.

Journal checkpoints expose only flushed operation receipts. New snapshots
must match a sequence/digest in the supplied journal and all attachments must
exist and authenticate before the snapshot is published. State is finite JSON,
cloned before asynchronous work; application reducer/schema correctness is not
inferred from a matching receipt. Reads revalidate referenced attachments.
Snapshots are immutable IDs, not a mutable latest pointer. No journal truncation,
compaction or automatic snapshot selection is enabled; full journal remains
authoritative. There is no independently trusted anti-rollback checkpoint.

Snapshot bundles are themselves encrypted/authenticated and contain exactly one
snapshot and its referenced original attachments. They exclude operation
history, prior snapshots, unrelated/orphan objects and keys: **not a full Teams
backup**. Restore requires the same team identity/object key, validates the whole
bundle before writing, publishes attachments first and snapshot last. It can
restore absent files but rejects existing corruption. An I/O failure can leave
valid unreferenced attachments; multi-file restore is not one filesystem
transaction. Restored state must be reconciled with its original journal before
use; bundle import alone never authorizes a state or creates a live Team.

Verification: `tsx backend/scripts/teams-objects-test.ts` passes 11 grouped checks:
encryption/owner-only permissions/clone-before-await, concurrent deduplication,
path/key/team isolation, journal-bound snapshot roundtrip and checkpoint mismatch
refusal, missing/invalid references and JSON, encrypted separate-store bundle
roundtrip/idempotence, corrupted/truncated/wrong-team bundle refusal without
writes, immutable corruption preservation, orphan exclusion, absent-attachment
restore and real SIGKILL after durable attachment receipt followed by reopen.
The 11 journal checks (including disk-flush failure and process kill), backend
TypeScript and backend production build also pass. No UI files changed, so no
render verification was needed. Physical power loss, Windows/native filesystems,
large-data streaming/memory/DoS limits and security certification remain untested.

Next recovery requirements: full journal+snapshot+attachment backup validation,
persisted client pending/reconnect queues, typed deterministic replay and usable
offline recovery tooling. Permissions/authentication and protected key management
must be in place before HTTPS host/join or collaborative Board/BackChat exposure.

## Full offline storage-package checkpoint — 2026-11-12

`backend/src/teams/recovery.ts` adds encrypted full **storage** recovery packages:
the complete durable operation-log prefix and every committed object captured
from the dedicated team object directory, including old snapshots and
unreferenced original attachments. Pending ciphertext files are excluded. This
supersedes the snapshot-only bundle limitation for this API; snapshot bundles
remain deliberately narrow. Keys, invitations, membership credentials, future
pending-client queues and private local data are not part of these packages.
There are still no Teams routes, listeners, UI or production activation path.

Export freezes the journal's queued append ordering while capturing objects.
Strict read-only journal inspection validates every complete record; unlike
normal crash recovery, package inspection never accepts/truncates a torn tail.
All objects authenticate, every snapshot attachment must be present, and every
snapshot checkpoint must match the packaged journal. Corrupt source data fails
export, not silently drops records. Unexpected non-temporary files in the
object directory also fail export. Object files remain immutable, but independent
object publishers are not locked: callers should quiesce uploads/snapshot
creation for an exact inventory boundary. Races yielding inconsistent references
fail validation rather than produce a claimed good package. Application-level
references embedded in opaque operation payloads cannot yet be checked: typed
Board/BackChat replay and attachment-reference validation remain required.

Packages and restore markers use AES-256-GCM and team-specific authenticated
context. Three distinct 32-byte keys are required: journal, objects and backup.
No keys are included in packages or markers. API-owned recovery-key copies are
cleared after each operation; this is best effort, not a JS-memory erasure
promise. Existing long-lived journal/object instances and caller-owned keys have
their own lifetimes. Protected key provisioning/rotation/recovery remain future
work. Loss of any required key can make recovery impossible; package possession
alone cannot recover these keys. An authorized host remains trusted with plaintext.

`exportRecovery` returns an encrypted Buffer, not a saved off-device backup.
The eventual operator tool must durably persist, verify and safely copy it.
`inspectRecovery` authenticates the full package without filesystem writes.
`restoreRecovery` validates everything before creating a **new** destination;
it rejects any pre-existing destination, even an empty directory. It never
merges into a live Team, deletes prior data or steals journal locks. Restore
publishes dependencies before snapshots and writes/fsyncs an authenticated
`READY` marker last. The `INCOMPLETE` provenance file intentionally remains;
without a successfully verified READY, a directory is incomplete regardless of
which data files are present. Failed/crashed attempts are left for offline
inspection; retry targets a different new directory.

`verifyRestored` is read-only, requires no journal writer lock to be present,
and checks READY authentication, exact committed object identities, contents,
snapshot references and the full journal checkpoint. It is an **offline restore
artifact verifier**, not a verifier to run after new live writes. Stopping all
writers is an operator precondition, not enforced by an OS-wide lock. The marker
records the originating package SHA256 for provenance; it is not an external
anti-rollback authority. Valid old whole-package rollback still cannot be
detected without a separately trusted checkpoint.

Restoring a snapshot does not prove the arbitrary JSON state was correctly
reduced from its operation history. No reducer, Teams permission model, reconnect
protocol, backup UI/CLI, full filesystem fault matrix or automatic recovery is
implied. The APIs load whole logs/objects/packages in memory: bounded/streamed
large-data processing and hostile-data resource limits remain unfinished.
Use trusted private existing local parent directories only. Native/Windows,
network filesystems, hardware power loss and security certification are untested.

Verification: `tsx backend/scripts/teams-recovery-test.ts` passes 8 grouped checks:
full encrypted roundtrip with historical journal/snapshot/unreferenced originals,
retry receipt preservation, existing-destination refusal, corrupted/truncated/
wrong-key/wrong-team/version/checkpoint/missing-reference packages with no writes,
authenticated exact-inventory verification and live-lock refusal, frozen append
boundary, corrupt source refusal, and real SIGKILL after restore data publication
but before READY followed by incomplete-destination rejection and successful
separate-destination recovery. Existing 11 journal and 11 object checks pass,
as do backend TypeScript and production build. No provider calls/networking/UI
changes. This is implementation documentation, not release notes.

Next: typed deterministic replay/reference validation and persisted pending-client
queues/reconnect tests, then recovery tooling/protected keys and authorization
before host/join exposure.
