# Teams: live awareness, presence, access and storage operations

Working-branch implementation, not a release or deployment. This adds bounded collaboration operations; it does not turn whole-Board CAS publication into a CRDT or automatically deliver recovered sends.

## Live update awareness

After explicitly connecting, enable **Watch shared state while this page is visible**. This starts one serialized read immediately, then waits five seconds after each completed read. Hidden tabs and browser-reported offline state pause requests. No credentials are persisted, reconnect attempted, invitations redeemed or content submitted by the watcher. Disable it, disconnect or leave to abort the active request and cancel the next timer. The host sees authenticated reads; this is not anonymous monitoring.

A newer observed sequence invalidates loaded Board/BackChat send gates and clears publication consent, preserving exact unsent drafts and uncertain operation identities. Explicitly load/refresh each shared view to review and reconcile. No automatic snapshot replacement, item merge or send occurs. In-flight manual reads older than an already-observed sequence cannot re-enable sending. Reads can be bounded by existing response/rate limits; any read/validation failure stops monitoring and requires an explicit restart. Recorded successful timestamps are historical observations, not proof of current connectivity.

### Separately consented presence

Enable **Also share my temporary member presence with this Team** only if you want active authenticated members to see your member ID. Each visible monitoring cycle then sends an authenticated heartbeat, after its read. The dedicated host keeps session-keyed leases in memory for at most 30 seconds, capped by session expiry. Nothing enters the journal, encrypted drafts or recovery exports. Multiple sessions of a member collapse to a single member display. Revoked/expired sessions and inactive members are filtered on inspection; host restart clears all leases. It is not an attendance log, cursor location, identity proof or proof that someone is editing.

Disabling, hiding, going offline or leaving stops heartbeats; the last lease expires, not immediate guaranteed removal. An in-flight heartbeat may already have reached the host. The displayed member list is the last successful observation and can be stale. Enabling presence does not enable publication or delivery. `GET /presence` reads current leases; `POST /presence` accepts exactly `{announce:true}`. Both use existing authentication, host/origin, rate and response-budget rules. No unauthenticated presence discovery exists.

## Owner/Admin access management

Open the disclosure and explicitly load access records. No records are fetched on mount. Current server-side authority, not last-known UI role, governs all operations. The UI supports:

- Existing member role changes (Admin/Editor/Viewer) and activation/deactivation, excluding Owner changes.
- Exact-digest invitation/session revocation.
- Single-use invitation creation with explicit role and separate invitation/session lifetimes, each 1–1440 minutes.

Every mutation requires an exact selected action and fresh consent. Success requires a host receipt; refresh records after acknowledgement. Failed/uncertain mutations do not retry. Invitation creation is limited to one attempt per connected view to prevent blind recreation after a lost response. Reload access records to identify/revoke any orphan invitation before deliberately creating another through a new connection. This is a safety gate, not a server deduplication guarantee for privileged calls.

Created invitation tokens are masked and memory-only, explicitly selectable for private handoff. No clipboard copy, network sharing, file export or model interaction occurs automatically. Forgetting a token does not revoke it. All-session recovery, Owner transfer, direct new-session issuance and certificate/keychain operations remain operator-only. Deactivation revokes existing sessions and invitations issued by that member; reactivation does not resurrect revoked sessions. Revocation cannot erase already downloaded information.

## Attachment storage admission quota

The dedicated HTTPS host configuration optionally accepts `limits.attachmentStoreBytes`, a positive safe integer. Existing configurations continue to work without a new implicit quota. It limits new **attachment admission** against the current committed encrypted object inventory (attachments and snapshots) plus the new object's 28-byte AES-GCM overhead. Existing identical content is integrity-validated and deduplicated without charging new bytes. Host upload operations are serialized so simultaneous authenticated uploads cannot both reserve the same remaining budget. A refused upload returns HTTP 507 `attachment_store_quota_exceeded`, no object ID or successful ACK.

This is not an OS disk quota or a limit on journal/key/log/temporary-file growth. It does not retroactively remove data or constrain trusted-local recovery imports. Inventory validation currently reads the archive and is not constant-memory; use conservative host budgets and disk monitoring. The per-request min(controlBytes, 1 MiB) transfer ceiling still applies. Resumable large-file streaming is **not** added by this quota.

## Offline orphan management

Stop the dedicated host/writers. Back up first and preserve any pending reviewed drafts. Operator passphrases use the existing non-TTY stdin mechanism, never shell arguments/environment/chat.

```
node bin/research-engine.mjs teams storage-audit PRIVATE_HOST_ROOT
node bin/research-engine.mjs teams storage-prune PRIVATE_HOST_ROOT REVIEWED_PLAN_SHA256
```

Source checkout equivalent: `npm run teams-host --workspace backend -- storage-audit PRIVATE_HOST_ROOT` (or `storage-prune`). Supply the passphrase privately to stdin using your normal secure operator workflow; examples intentionally do not put a real passphrase in shell history.

Audit acquires the exclusive journal writer lock, decrypts/validates object integrity and deterministic journal/snapshot replay, validates owner-only regular object files, and reports ciphertext bytes, unreferenced attachment IDs/bytes, checkpoint and a SHA-256 review-plan digest. It returns no plaintext, credentials or encryption keys. Audit does not delete anything. Never treat a missing object reference in only the latest Board as an orphan: historical references and snapshot dependencies are retained.

Prune repeats validation under the lock and requires the exact reviewed checkpoint/full-ciphertext-inventory digest before deleting only those unreferenced attachment files. Any intervening upload, object change or journal append invalidates the review. No snapshots, history or referenced files are deleted. A partial prune interrupted by I/O failure can leave a subset removed; all selected files were unreferenced, and a new audit/review is required. Temporary `.pending-*` files are excluded, not automatically purged. Unauthorized external filesystem writers are outside the cooperative writer-lock threat model.

**Important:** orphan means unreferenced by durable host history, not unwanted by every client. An uploaded but not yet published draft may depend on an orphan ID. Coordinate with editors and retain originals before pruning. The operator must not assume absence proves client abandonment. Restored stores containing READY/INCOMPLETE manifests are refused because removing any manifest-covered inventory would violate authenticated restore verification. Backups already taken retain their own encrypted orphan bytes; pruning is not forensic erasure or backup revocation.

## Evidence

- `teams-watch-test`: deterministic hidden pause, serialized requests, regressing sequence/failure stop, no retry, abort/late-response suppression, namespace/privacy-scope stop.
- `teams-storage-test`: live-writer lock refusal, historical/snapshot retention after current Board removal, exact-plan/no-write refusal, changed-inventory refusal, reviewed orphan deletion, validated post-prune backup, encrypted-byte quota and dedup.
- `teams-host-test`: ephemeral leases do not advance history, TTL expiry and revoked-session filtering, plus existing role/concurrency/recovery checks.
- `teams-managed-test`: real local disposable-CA TLS client presence, role-scoped access load, invitation creation/redeem/revoke, deactivation/reactivation without resurrecting sessions, session revocation, HTTP 507 quota refusal, existing two-principal CAS/fault tests and built CLI drain/restart.
- Browser connection suite: opt-in watch/presence, unsent composer preservation/consent invalidation, failed-watch stop; existing drafts/attachments/credential tests.
- Browser access suite: no auto-read, reviewed exact action, consent reset, one-attempt invitation, masked token/forget, errors and 1440/390/320 containment. Inspected the 320px screenshot. Mocked browser transport is separate from real local TLS evidence.

## Remaining Teams completion gates

- Resumable large-file encrypted streaming, resumable custody and abandoned partial-upload cleanup.
- Automatic safe application of remote content / granular concurrent editing beyond explicit whole-revision CAS; live cursors are not implemented.
- In-app native host lifecycle/recovery wizard and OS certificate/keychain custody; the browser intentionally cannot open a listener or accept host secrets.
- Full screen-reader/keyboard audit, long-duration/resource/fault testing, packaged native installers, physical devices and real multi-host networks. Local loopback TLS/browser viewport checks do not certify these.

These gates remain open. Do not label the entire Teams roadmap complete from this checkpoint.
