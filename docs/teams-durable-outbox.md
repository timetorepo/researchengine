# Browser durable operation recovery

Working branch, 2026-11-12; not a release or unattended background-sync system.

## Scope delivered

Shared Board publication and BackChat sends now have an optional encrypted browser outbox. Each browser namespace / exact HTTPS origin / team / member / operation kind has one pending head. This is a bounded single-head lane, not a multi-entry FIFO queue. Board and BackChat have separate lanes. No credentials, raw original files or passphrases are stored. Browser namespace is enforced by database separation; cryptographic file binding authenticates origin/team and encrypts the member and operation identity/content using the existing versioned Board/BackChat draft formats. Namespace is not an extra cryptographic field in those export-compatible formats.

In **Durable Board/BackChat send recovery**, enable encrypted saving and enter/confirm a strong unique 12–1024 UTF-8-byte passphrase. This preference and passphrase are memory-only, not restored automatically. Durable sends require the passphrase for every new operation; it is cleared after encryption. The exact original operation is encrypted with randomized AES-256-GCM/PBKDF2-SHA256 (600,000 iterations), saved with atomic IndexedDB `add`, and the transaction must complete before any Team request. Strict transaction durability is requested where supported; unsupported/storage-failed browsers fail closed rather than silently sending an unprotected operation.

A saved record contains the destination/member/lane key, operation ID and bounded ciphertext (at most 100,000 bytes), not plaintext evidence or Team credentials. ID/destination/member metadata is not secret. Content limits are unchanged: 64,000 serialized Board bytes, 16,000 BackChat text bytes, bounded attachment/reference arrays. Encryption is not protection from malicious code already running in the unlocked origin.

Even a memory-only send explicitly checks for an existing saved head before dispatch. Turning the preference off does not delete or bypass an already saved operation. Competing durable tabs use the same atomic lane: only one may insert; the other retains its draft and does not dispatch. This is not a distributed lease across all memory-only tabs; normal concurrent edits still use host CAS and conflict handling.

## Reload/reconnect and recovery

1. Reconnect explicitly using an invitation or portable credential. No credential is automatically persisted by this outbox, and there is no background reconnect.
2. Open the correct recovery section and **Inspect saved pending operation**. The exact namespace/destination/team/member/kind is read; nothing is sent to the Team.
3. Unlock using the original passphrase. The entire payload/actor/identity is validated. Wrong scope/passphrase, malformed schema or an ID/ciphertext mismatch is refused without changing saved bytes or dispatching.
4. If no existing draft would be replaced, **Restore frozen pending draft**. Ordinary send/publish remains disabled. Read shared state explicitly to reconcile a matching committed post/revision.
5. Alternatively review the exact unlocked operation, explicitly consent, then **Retry exact saved operation**. The original ID, actor and payload are reused, never regenerated. The host's journal deduplicates exact already-committed operations. This may commit an operation that had never reached the host; consent therefore matters even after reconnect.

A valid ACK or exact-snapshot reconciliation removes only the matching local head. Initial, definitely rejected new sends retain their draft but release that new record. **A rejection of a retry does not prove that the original attempt never committed** (for example membership may have changed), so retry rejections preserve both ciphertext and the frozen draft. Reconnect/refresh, export and investigate with the host. There is intentionally no destructive "forget and resend with a new identity" button.

Cleanup failure never deletes a different operation's head. It can block later sends until the record is inspected and its exact identity reconciled/retried; it does not fabricate a clean lane. Current browser/host state, not an optimistic UI edit, remains authoritative.

## Privacy, wipe and backups

Explicit encrypted export of the saved operation is available. Its bytes use the corresponding existing `.reteam-draft` or `.reteam-chat-draft` file format. Existing file recovery can restore a frozen draft and reconcile it, but does not automatically enroll an imported file into a new browser outbox lane or enable replay there. Browser outbox recovery/retry operates on the saved browser record. Keep both credentials and encrypted draft files backed up separately and verify downloads: a download request is not proof of saving.

The privacy wipe now launches deletion of main/guest Board and outbox databases and freezes late storage opens/writes. Database version-change handlers close connections. Failure to finish is reported as local Board/Teams-outbox deletion failure, not success. No outbox is shared across guest/main namespaces. Browser clearing/eviction still destroys local records, and downloads outside the origin cannot be deleted by app wipe. Passphrase strings and decrypted in-memory payloads cannot promise forensic zeroization.

Original attachment bytes, unsent edits before publication, local canvas history and private Boards are not silently persisted by this operation outbox. The write-ahead record is created only after explicit publication/send consent; original-file uploads remain separate consented operations. Lost-upload responses and orphan quotas remain separate work.

## Verification

- `npm run teams-outbox-test --workspace backend`: exact Board/BackChat operation roundtrip, revisions/IDs/links/attachments preserved, randomized ciphertext, wrong pass/member and extra-field refusals; no IO/dispatch.
- `tools/design/check-teams-outbox.mjs`: real browser IndexedDB with intercepted Team transport. Verifies a committed encrypted record exists before dispatch; a lost response followed by reload and explicit credential-file reconnect; no automatic resend; no credential/evidence/passphrase plaintext in stored record; memory-only bypass refusal; wrong-pass unlock without dispatch; restore freeze; rejected retry retains the original identity; consented exact replay yields one post; ACK cleanup; two competing inserts yield one head; wrong-ID delete refusal; member isolation; injected quota refusal prevents dispatch; main/guest wipe and late-write freeze.
- Shared Board browser suite exercises opt-in durable publication and passphrase clearing, alongside its existing conflict/merge/original-file checks. Existing BackChat/credential/attachment regressions remain gates.
- Actual disposable-CA TLS tests already exercise exact-operation deduplication, simultaneous principals, stale revisions and lost-response reconciliation. The new IndexedDB reload scenario uses mocked transport, not a public production host.

No automatic FIFO drain, unattended background sync, live presence/cursors, host-blind E2EE, real-network soak, browser-eviction safety, power-loss/fsync certification, native keychain or full screen-reader/device certification is claimed. Browser persistence depends on browser/OS policy. Website remains paused; no deployment/provider billing was performed.
