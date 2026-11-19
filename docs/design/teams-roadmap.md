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

## Typed deterministic replay checkpoint — 2026-11-12

`backend/src/teams/replay.ts` defines a small offline v1 Teams protocol and a
pure deterministic reducer. Nothing is registered with the server or frontend.
No private Board migration/import, network traffic, membership authorization or
live collaborative feature is enabled. No dependencies added.

Two operation kinds are currently supported:

- `team.board.replace.v1`: a full Board item-set/title replacement with an exact
  expected revision (zero creates, each accepted replacement increments by one).
  Items cover note/reference/image/PDF/drawing/shape/connector/frame geometry,
  text/Markdown, sources and attachment IDs. Fields are strict/versioned;
  geometry must be finite with positive dimensions, links must resolve, parents
  must be frames without cycles, connectors need distinct non-connector targets,
  and normalized drawing coordinates must lie within the unit square. Image/PDF
  cards require a committed original. This is not incremental merge/CRDT or a
  frontend schema migration; future adapters must explicitly validate/translate.
- `team.backchat.post.v1`: append-only text, attachments and revision-pinned Board
  or item references. Message IDs are globally unique in this team history;
  actor comes from the recorded operation envelope, not a separately supplied
  post-author field. This **does not authenticate** that actor: the future
  service must bind it to the authenticated member and enforce permissions.
  Links must resolve against the current Board revision at post acceptance.
  They remain explicitly historical references if a later replacement removes
  that item; no live-link claim or cascade deletion is made. Edits/deletion,
  threads UI, unread state and live collaboration are not enabled.

Replay rejects unknown operations/versions, extra fields, invalid identities,
sequence gaps/duplicate operation IDs, conflicting expected revisions and
invalid posts/links. It has no clocks, randomness, locale-dependent sort or
input mutation. Board ordering and cumulative attachment identities are stable;
post/item arrays preserve recorded order. Every attachment referenced anywhere
in history remains required, including originals removed from current cards.
There is no history-pruning/GC policy yet. Replaying a failed operation does not
mutate input state, but the generic journal remains a storage primitive: a
future serialized service must validate against current state **before append**
rather than append invalid operations and hope replay repairs them.

Recovery APIs now accept `team-state-v1` in addition to the existing
`storage-v1` validation policy. Typed packages are always replayed when read,
including through a default-policy call. They validate the entire history and
all historical attachment references, then compare every snapshot's JSON state
and cumulative attachment list with replay at that exact checkpoint. Object
property order is ignored; array order and values are not. Snapshot sequence/digest
binding still comes from authenticated journal inspection. Snapshots do not
skip full replay. The encrypted restore READY marker preserves this policy.

Callers can explicitly require `team-state-v1` for inspect/restore/verification;
storage-only packages/markers are then rejected before destination writes.
Legacy packages with no policy field remain storage-only for compatibility;
they never become typed/activation-ready implicitly. Future Team activation
must require typed validation. `storage-v1` remains useful for opaque prototype
archives but does not establish valid application state. No authenticated
history is silently discarded or reinterpreted to make it pass.

Verification: `tsx backend/scripts/teams-replay-test.ts` passes 10 grouped checks:
deterministic immutable replay, strict fields/versions/geometry/provenance,
revision/sequence/identity conflicts and drawing/connector rules, historical
BackChat links and cumulative originals, malformed/duplicate posts and missing
attachments, exact checkpoint snapshot equality and invented-state refusal,
canonical property order, typed full package/replay/restore roundtrip, explicit
policy downgrade refusal before writes, and invalid typed source snapshot
refusal. Existing 8 recovery, 11 object and 11 journal checks pass, including
process-kill tests. Backend TypeScript and production build pass. No UI files
changed; native/physical-device, large-data/DoS, full reducer performance and
security certification remain untested.

Next: durable pending-client/reconnect queues with explicit conflict retention,
then recovery tooling/protected keys and per-request authorization before HTTPS
host/join or live collaborative Board/BackChat exposure.

## Durable pending-client queue checkpoint — 2026-11-12

`backend/src/teams/pending.ts` adds an offline **Node-side** client outbox
primitive, using a separate encrypted TeamJournal and an explicitly supplied
transport callback. It is not wired to browser IndexedDB, native sidecars, UI,
server routes or a network transport. No timers, reconnect connections, provider
calls or automatic background tasks are started. The first integration will
need an appropriate browser/desktop persistence adapter and visible controls;
this checkpoint does not claim browser-tab durability.

A queue is explicitly bound to one team, client and recorded actor. The binding
is durably recorded before use; reopening under another scope is rejected,
not reset. Its dedicated key must be independently protected and preserved by
the caller. Object-store team identity must match. Actor binding is local scope
validation, **not authentication**; the future host must bind each request to
its authorized member, enforce roles and check typed state before append.

Enqueue validates/clones a typed operation, checks that all referenced original
attachments are already committed/authentic in the local TeamObjects store,
then flushes a queue event before making it visible for dispatch. Local duplicate
IDs with identical serialized operations are idempotent; changed content under
an existing ID is rejected. Pending, acknowledged, conflicted and superseded
operations remain in local history; enqueue never resurrects a terminal item.
The queue stores references, not original bytes: its journal and local objects
must be retained together. Full host recovery packages do not include this
separate client queue or its key. Client-outbox export/restore remains unfinished.

Each explicit `drain` makes at most one sequential pass until idle, failure,
conflict or stop; simultaneous calls share one active drain. An attempt is
persisted before invoking transport. Attachment bytes are checked again before
dispatch. No automatic retries/backoff, rebasing, model calls or fallback exist.
Transport errors, lost responses and malformed/mismatched receipts retain the
operation as pending and stop the pass. Another explicit drain retries the
**same operation ID**; the host must persist idempotence/deduplicate before ACK.
Transport ACKs are checked for operation ID and well-formed receipt, then saved
locally before the item becomes acknowledged. Receipt shape is not proof of a
real host flush: the production authenticated/TLS host transport and
persist-before-ACK implementation are still required.

A reported conflict durably blocks the FIFO head and all dependent followers.
`replaceConflict` requires an explicit new typed operation with a fresh ID and
valid originals. The original remains superseded with its replacement ID; the
replacement occupies the same queue position ahead of dependent work. This is
not an automatic merge or permission to drop an unknown host outcome. There is
no discard API or silent revision rewriting in this first pass. Later followers
may independently conflict and must receive explicit resolution.

Stop and close abort the local dispatch wait, even if a callback ignores its
AbortSignal. Late responses cannot acknowledge retained work. Remote commit may
already have happened: stop is not remote rollback. Close drains accepted local
writes and abort-result persistence before closing storage. Local write/flush
failure poisons the queue and prevents further dispatch until reopen/recovery;
a complete but unacknowledged local event may survive, so replay is authoritative.
Real process death still leaves the journal's exclusive writer lock; explicit
offline lock recovery is required, never automatic PID/age lock stealing.

Transport callbacks must not wait on the same queue's `close`/`drain` from within
themselves. The eventual transport must provide timeouts and authenticated,
scoped endpoints; no request deadline is imposed here beyond caller AbortSignal
or explicit Stop. No compaction/resource bounds/streaming, cross-device delivery,
authorization, protected key storage or pending-queue recovery UX is delivered.
All operations and history are loaded into memory. Hardware power loss, Windows,
native/physical-device behavior and security certification remain untested.

Verification: `tsx backend/scripts/teams-pending-test.ts` passes 12 grouped checks:
encrypted persist-before-dispatch and immutable/idempotent enqueues, scope/actor
isolation without resetting logs, fake host commit/lost ACK/reopen/same-ID retry
without duplication, one concurrent drain, FIFO conflict retention and explicit
replacement, stop/uncooperative transport/late ACK, malformed receipts, committed
original availability and corruption blocking, close/late-response retention,
local ACK-flush failure, enqueue-flush failure with no dispatch, and real SIGKILL
after enqueue and after host commit before client ACK followed by offline lock
clearance/recovery/idempotent delivery. Fake transport only: no network requests.
All 40 earlier journal/object/recovery/replay grouped checks also pass, together
with backend TypeScript and build. No UI changed, so no render verification was
needed. `npm run teams-test --workspace backend` runs all 52 grouped checks.

Next: operator recovery/key-protection tooling and a serialized authenticated
host service with per-request permissions, then client persistence/transport
integration and HTTPS host/join. Networking remains disabled until those gates
are in place.

## Protected host-keyring and offline operator checkpoint — 2026-11-12

Added `keyring.ts` (scrypt/AES-256-GCM wrapped independent journal/object/backup
keys), `operator.ts`, and the source-tree `teams-offline` command. Operator guide:
`docs/teams-offline-recovery.md`. No dependencies, listeners, UI, member identities
or production/desktop packaging added; private local storage is not accessed.

Commands initialize a new owner-only encrypted host root, export/verify typed
full-storage packages and restore/verify a separate new data root. Keyring and
source host paths require owner-only regular file/directory types and reject
symlinks. Passphrases are accepted only via bounded non-TTY stdin; never command
arguments/environment. CLI output excludes keys/secrets and arbitrary error
contents. Separately preserve `host.keys` plus its passphrase: data packages
contain neither. This is passphrase protection, not an OS/hardware keystore,
key rotation, unattended startup or host-blind E2EE. Key loss remains unrecoverable.

Journal/object opens now support strict existing-store modes. Operator backup
uses these and refuses damaged tails instead of silently truncating source data,
missing journal/object storage instead of creating empty replacements, and live
or stale writer locks instead of stealing them. Backup/keyring file publication
uses owner-only same-directory temporary ciphertext, file sync, no-overwrite
hard-link publication and directory sync. Failed new-root operations can leave
partial evidence; no automatic delete/reset/repair. Restores do not copy keys
or activate a service. The CLI currently backs up initialized host layouts;
separate key-root/data-root activation and client-outbox recovery remain future.

Verification: `teams-operator-test.ts` passes 8 grouped checks: independently
randomized encrypted keyrings/roundtrip/no plaintext keys; wrong password,
metadata/tamper/KDF/format refusal; private/no-overwrite initialization; typed
backup/verify/restore and active-lock/no-overwrite refusal; corrupted-package
no-write behavior; permissions/symlink refusal; missing/damaged source
preservation; subprocess CLI initialization/backup/verification/restore,
non-TTY passphrase input, secret-free output and invalid input/argv refusal.
All 60 grouped Teams checks, backend TypeScript and production build pass.
No UI changes require render review. No claim of physical power-loss, native,
Windows, exhaustive fault-injection/large-data or security certification.

Next: a serialized host service binding authenticated actors to Owner/Admin/
Editor/Viewer permissions and enforcing typed preflight before durable append;
then protected authentication/invite lifecycle and HTTPS transport/client
integration. Networking remains disabled.

## Local serialized host and durable access checkpoint — 2026-11-12

`backend/src/teams/host.ts` adds a **local-only library** owning the journal's
exclusive writer connection. It is not imported by the server, offline CLI or
frontend; no routes/listeners, TLS, invitations, owner login UI or remote access
are enabled. `access.ts` defines deterministic access-control operations and
state. No dependencies/private-local resource access added.

An existing empty journal requires explicit trusted-local Owner bootstrap. The
first durable operation records the sole Owner and an initial expiring session
digest. Existing nonempty content-only prototype histories are **not** silently
migrated into a live host, nor can bootstrap replace an existing Owner. The
current offline `init` command still initializes storage, not a member identity;
this service must be explicitly instantiated by trusted source-tree code.
Owner transfer/removal and additional Owners are deliberately unsupported.

Credentials are random 32-byte bearer secrets returned once to the caller. Only
a team-scoped SHA256 digest, member ID, recorded issue/expiry times and revocation
flag enter encrypted history/snapshots. Raw credentials are neither logged nor
persisted by this library. Caller credential delivery/storage is still pending;
this is not identity-provider login, MFA or an invitation flow. Durations must
be positive and no more than 24 hours. Host time is checked per operation, with
expiry inclusive at the boundary and pre-issue times rejected. This trusts the
host OS clock; it is not trusted monotonic-clock/rollback protection.

All public operations enter one serialized service queue. Authentication and
current member role are checked when work executes, not before queueing; a
queued demotion/revocation takes effect before later work. Credentials are
rechecked immediately before journal append following async preflight. The
operation actor must match the authenticated session member. Admission to the
service is not permission to submit arbitrary access records through the content
endpoint: access management has dedicated methods with separate role checks.

| Action | Owner | Admin | Editor | Viewer |
| --- | --- | --- | --- | --- |
| Read shared content/referenced originals | Yes | Yes | Yes | Yes |
| Replace Boards/post BackChat/upload originals | Yes | Yes | Yes | No |
| Inspect access records | Yes | Yes | No | No |
| Manage Editor/Viewer members/credentials | Yes | Yes | No | No |
| Manage Admins / issue or revoke Owner credentials | Yes | No | No | No |
| Revoke own credential | Yes | Yes | Yes | Yes |
| Transfer/remove Owner | Disabled | Disabled | Disabled | Disabled |

Admin self-credential renewal is allowed; Admin management of Admin membership
or other Admin/Owner credentials is not. Owner can manage all sessions; only
Owner/Admin can issue sessions. Deactivation revokes all the member's existing
sessions permanently; reactivation does not revive them. Role changes are
resolved dynamically on each operation. Reads expose cloned content state and
caller role, not access/session records; Owner/Admin have a separate access
inspection method. Originals must be referenced by team history before general
read access; unreferenced uploads are not an arbitrary file-read endpoint.

The service validates full typed state and attachment dependencies **before**
append. Revision races serialize: one accepted replacement increments the Board
revision and the stale competitor fails without a journal receipt. Exact
operation retries return the original durable receipt without replaying a
conflicting old revision; authentication/current write permission still precede
deduplication. A reused ID with changed content is rejected. State publication
and success receipts follow journal fsync. A failed append/flush poisons the
service, keeps its last confirmed in-memory state and prevents even stale reads
until close/recovery; complete unacknowledged events may survive for replay.

The typed replay protocol now additionally supports versioned bootstrap,
member-change, session-issue and session-revoke records. `TeamState.access` is
optional to preserve existing opaque/content-only prototype histories, but host
activation requires first-operation bootstrap. Once access is present, replay
itself enforces content-write and access-management roles at each historical
position. Client outboxes explicitly reject these privileged operation kinds.
Full typed recovery now preserves access/session-digest/revocation records when
present; raw bearer tokens remain excluded. Recovery/legacy storage-only
validity is not automatically permission to activate a host.

**Release gate:** a valid *older* whole backup can reintroduce credentials revoked
after that checkpoint. Existing absence of trusted anti-rollback authority still
applies. Restored-host activation must add explicit session epoch invalidation/
rotation and operator confirmation before network exposure. All-session expiry
can also lock out this prototype: trusted-local credential recovery/rotation is
not implemented, and re-bootstrap is intentionally forbidden. There is no
production activation path that bypasses these unfinished gates.

Verification: `teams-host-test.ts` passes 11 grouped checks: durable Owner and
role setup; all four role gates, actor spoofing/access-injection rejection and
secret-free content reads; Admin/Owner boundaries; concurrent revision races and
idempotent retry; queued demotion/deactivation/reactivation; exact expiry,
clock bounds, duration limits and revocation; original reference scope and
missing-original preflight; actual host+outbox lost-ACK retry without duplicate
commit; plaintext token exclusion plus restart/typed recovery preserving
revocations and replay role/bootstrap refusal; cross-team credential isolation;
and injected flush failure with no success/state publication. All 71 grouped
Teams checks, backend TypeScript and build pass. No UI files changed and no
network/provider requests were made. Native/device, production DoS/rate limits,
large-history performance, trusted-clock behavior and security audit are not
certified. Replay currently scans/clones whole history per write; this is an
engineering foundation, not a production-throughput claim.

Next: protected credential recovery/rotation and restore activation safeguards,
then scoped expiring/revocable invitations and explicit HTTPS transport/client
integration. Network exposure remains disabled until these gates are tested.
