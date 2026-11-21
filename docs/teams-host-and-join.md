# Teams host, join and portable custody checkpoint

Working branch, 2026-11-12; not a release or deployment. This is a connection and local-operator milestone, **not completed collaboration**. The `/teams` page reads shared-state counts and has an explicitly loaded Teams-only text BackChat. It also supports reviewed, revision-checked shared note Boards, not the full collaborative canvas. A trusted authorized host can read shared plaintext; this is not host-blind E2EE.

## Explicit local operator lifecycle

Build the backend (`npm run build --workspace backend`), then use `node backend/bin/research-engine.mjs teams …` in a source checkout. In a Node portable distribution use `node bin/research-engine.mjs teams …`. The default top-level portable launcher still launches the application, not the Teams CLI. Bun single-file packaging is not verified for this workflow. The CLI bundle is included by the Node packaging script; a full assembled distribution has not been acceptance-tested.

Pass a strong unique 12–1024-byte passphrase using **non-TTY standard input**, for example an OS secret manager piping into the command. Never put it in arguments, shell history, environment variables or a web form. The same operator passphrase is used for the host keyring and these Owner artifacts; use the separate portable-file UI export to choose a different portable passphrase. Parent directories must already be owner-only, and output files must not exist. Commands print only non-secret status; failures may follow durable commits. Never delete/reinitialize a host to work around an uncertain result.

Command shapes (`…` means the CLI prefix above):

```
… init /private/team-data my-team
… bootstrap /private/team-data owner-member-id 86400000 /private/owner.enc
… export-owner /private/team-data /private/owner.enc https://team.example:8443 /private/owner.reteam-client
… invite /private/team-data /private/owner.enc https://team.example:8443 Editor 600000 86400000 /private/invitation.json
… serve /private/host.json --confirm-network-exposure
```

Stop the listener before offline operations; the exclusive journal writer lock refuses concurrent access. `bootstrap` runs only on fresh initialized history, producing an encrypted Node scrypt Owner artifact. `export-owner` verifies its current identity against local durable access state and produces the distinct browser-compatible portable format. `invite` writes an owner-only **plaintext capability-delivery file**: its invitation token grants the preselected role once. Transfer it privately; never publish it or treat it as an encrypted backup. The browser currently requires copying its exact `origin`, `team` and `invitation` fields into the join form, not importing invitation JSON.

Example complete owner-only `host.json` (replace all paths/addresses; do not use example domains as real destinations):

```json
{
  "keyRoot": "/private/team-data",
  "dataRoot": "/private/team-data",
  "certFile": "/private/tls/certificate-chain.pem",
  "keyFile": "/private/tls/private-key.pem",
  "confirmNetworkExposure": true,
  "bind": "0.0.0.0",
  "port": 8443,
  "publicOrigin": "https://team.example:8443",
  "allowedOrigins": ["https://research.example"],
  "allowNativeClients": false,
  "limits": {
    "controlBytes": 1048576,
    "activeRequests": 20,
    "requestsPerMinute": 120,
    "trackedClients": 100,
    "requestTimeoutMs": 15000
  }
}
```

The listener requires a currently valid certificate matching the public hostname/IP and exact HTTPS UI origins; the browser must trust its chain independently. Never bypass certificate validation. Private key/config files are owner-only regular files. SIGINT/SIGTERM stops admission, drains requests and the journal queue, closes the writer and clears mutable host-key buffers. Runtime hard kills/power loss and native platforms are not certified. The server is dedicated TLS, not a reverse proxy, tunnel, discovery service or main-application API exposure. Configure firewall/routing yourself; no public listener was deployed for this checkpoint.

## Browser connection and custody

Open Teams in the sidebar. Enter the exact HTTPS host, team ID and private single-use invitation, or select a `.reteam-client` portable credential. File metadata is unauthenticated until unlock and is not evidence of host trust. Review the destination and explicitly consent before redemption/unlock/connect. Preparation/file inspection makes no Teams request. Wrong-passphrase unlock fails locally. No auto-retry follows uncertain redemption; ask the operator to review/revoke the old session and issue a new invitation.

A successful join followed by a failed state read retains the only session in memory, permitting explicit encrypted export or refresh. Export requires matching passphrases and produces randomized AES-256-GCM ciphertext with PBKDF2-SHA256 (600,000 iterations), scope-authenticated origin/team, 16-byte salt and 12-byte nonce. It is a separate format from Node scrypt Owner/client custody. Length alone is not passphrase strength. Browser downloads are not proof of successful durable saving: verify your saved file and keep its passphrase separately. Export does not extend expiry or prevent server revocation.

Disconnect, leaving the route or reload drops memory credentials. Disconnect does **not** revoke the server session. There is no automatic persistence, reconnect, polling, keychain integration or private-chat/local-Board upload. JavaScript strings and browser downloads cannot promise forensic zeroization. Before-unload warnings are best-effort and do not protect all in-app navigation; export before leaving.

## Recovery and unfinished work

Existing offline backup/verify/restore/Owner-recovery procedures remain in `teams-offline-recovery.md`. Preserve keyring/data/credential backups and test recovery offline. Host certificate installation, native custody, in-app host wizard/access administration/recovery, attachment streaming, full collaborative Board canvas, BackChat attachments/Board-link creation and durable reconnect/conflict integration remain unfinished. Owner invitations currently require stopped-host CLI operations; no UI access-management claim.

## Verification

- `backend/scripts/teams-portable-test.ts`: randomized envelope, wrong-passphrase, tamper/scope/schema/KDF/version/budgets, no unlock network, explicit read and expiry date range.
- `backend/scripts/teams-managed-test.ts`: private artifacts, actual disposable-CA TLS Owner and Editor join/read, exposure/writer gates, drain/reopen, built CLI startup/SIGTERM/restart; no production CA or deployment.
- `tools/design/check-teams-connection.mjs`: browser with intercepted host transport; explicit consent, download/import, wrong-passphrase/no-network, read/refresh/disconnect, uncertain redemption without auto-retry, reload memory reset, 1440/390/320 layout containment. Screenshots in ignored `.cache/teams`.

Browser emulation is not physical-device, screen-reader, OS-trust, public-host or packaging certification. No provider calls, deployment or billing incurred by these tests.

## Teams-only text BackChat continuation

Connected sessions can explicitly load/refresh validated shared posts, with author, thread, sequence, plain text, and existing attachment/Board-revision references. Text is rendered as text, not HTML; attachment references are not downloads. Compose has an exact-text/thread sharing checkbox, reset on changes, a 16,000 UTF-8 byte ceiling without truncation, current-state load prerequisite and Viewer gating. Host-side authorization remains authoritative. No model, private-chat import or autonomous tool is involved.

Sends have stable operation and post identities. A valid ACK clears the draft but does not fabricate a shared snapshot; explicitly refresh to see it. A rejected operation retains its draft and requires a new state/permissions review. An uncertain result freezes composition rather than creating a new identity/retrying. Refresh can reconcile an exact actor/thread/text/post-ID match. Absence does not prove rejection: keep the unresolved post ID/text and ask the host to investigate. There is deliberately no blind retry/abandon-and-resend button.

This is memory-only recovery **while the connection page remains open**, not an offline durable outbox. Leaving/disconnecting/reloading loses unresolved identity/draft state, and never rolls back a possibly committed post. Save relevant text/identity privately before leaving. There is no automatic polling, reconnect or background sync. Parent connection metadata refresh and BackChat refresh are explicit, separate snapshots; BackChat refuses regressing or malformed post snapshots and marks old data stale after failure.

The browser connection suite additionally checks consent reset, ACK, rejected-draft retention, uncertain committed-post reconciliation without duplicate sends, Viewer gating and connected layout containment at 1440/390/320px. Local TLS tests submit/read a post and replay an identical operation without duplicating it, and reject malformed post projections. Browser tests use mocked transport; local TLS uses a disposable CA, not production infrastructure. Full keyboard/screen-reader/native-device and large-history performance validation remain outstanding.

## Shared note-Board continuation

Connected sessions can explicitly load validated shared Board snapshots, select an existing Board, or create a new note-only Board. The editor keeps the loaded expected revision, title, note identities/text and geometry. It does not open local Board storage, import private content, delete existing notes, upload assets, pan a collaborative canvas or call agents. Boards containing any non-note item are read-only; their text fields are only a projection, not a complete rendering.

Publishing requires review of the entire draft and expected revision. Changes reset consent. The 64,000 UTF-8-byte draft limit refuses publication without truncation; host control-body limits remain authoritative. Viewer sessions cannot edit/publish. Every write has a stable operation identity and compare-and-swap expected revision. A host ACK requires an explicit refresh to show the durable snapshot.

On conflict, the draft is retained. Refresh displays the latest host snapshot alongside the unchanged draft. There is no automatic rebase, force overwrite or merge: export the draft if needed, explicitly discard it, select the latest revision, then manually reapply and review edits. Draft export is **plaintext** and includes destination/Board/operation identity, not credentials; keep it private. It is a download request, not proof of durable saving, and plaintext draft files are not accepted by the encrypted recovery importer.

Uncertain sends freeze editing. Refresh resolves only if the host reports the expected next revision with identical title/items. This confirms matching snapshot content, not operation/actor attribution. If a later edit has superseded it, the client cannot infer the outcome from the current snapshot: export the draft/operation identity and contact the host. No blind resend is offered. Leaving/reloading/disconnecting loses memory-only drafts and unresolved identities; it does not undo possibly committed writes.

Verification: the shared-Board browser suite covers reviewed creation, consent reset, competing revision rejection and draft retention, explicit latest-base selection, uncertain committed-write reconciliation without resend, Viewer/unsupported-item gates, 1440/390/320 containment, CSS 200% containment and keyboard discard. CSS scaling is not actual browser zoom or a full keyboard/accessibility audit. Disposable-CA real TLS tests exercise create/read, another member's edit, stale revision rejection without overwrite, and malformed Board projections. Existing Teams regression and BackChat/credential browser suites pass after moving the existing item validator into a shared no-IO module used by both host and browser. No production host, device or large-history certification.

## Encrypted Board draft recovery continuation

Use **Encrypted Board draft recovery** inside Shared Team Boards to explicitly export a `.reteam-draft` file. Enter and confirm a strong unique passphrase, kept separately. This distinct, versioned file encrypts the complete supported draft, expected revision, member and any unresolved operation ID with AES-256-GCM and PBKDF2-SHA256 (600,000 iterations); origin/team and format/KDF/nonce/salt are authenticated. Random 16-byte salts and 12-byte nonces are generated for every export. No session credential is included, and this is neither a credential backup nor a host backup. The file's destination metadata is visible, not secret. Drafts over 64,000 serialized UTF-8 bytes cannot use this bounded encrypted format; plaintext export remains explicit and sensitive.

To restore, connect as the same member to the exact same host/team, with no open Board draft. Select the encrypted file, review the displayed destination/member, enter its passphrase and explicitly confirm local restoration. Wrong destination, member, password, malformed schema, invalid geometry, modified ciphertext or unsupported format/KDF/version fail closed. The importer is bounded to 100,000 file bytes and does not accept old plaintext JSON, credential files or arbitrary local Board backups. No network or browser storage operation is performed by file inspection/unlock. Existing drafts are never replaced by import.

After restore, publication consent is off and state is not loaded. Explicitly load shared Boards to check current revision and permissions. Ordinary drafts must pass the usual conflict/review gates; restored unresolved operations remain frozen with the original identity until exact-snapshot reconciliation. No operation is sent by import or reconciliation. If current state cannot resolve a possibly committed operation, preserve the encrypted file and ask the host to investigate. Restoring as another member is deliberately refused rather than rewriting its actor identity.

Downloads are only requests to the browser: verify saving and test restore before discarding your work. No automatic persistence, remembered passphrase, OS keychain, offline queue delivery or background reconnect is implied. Plaintext export is still available and clearly labelled. Files protect content at rest only as strongly as their passphrase and client environment; JavaScript strings cannot promise forensic zeroization.

Evidence: `npm run teams-draft-test --workspace backend` covers randomized roundtrip (including revision zero/unresolved identity), wrong pass/member/scope, tampering, KDF/version/schema/geometry/size refusal. The Board browser suite exercises encrypted export, wrong-pass restore refusal, successful restoration of an unresolved operation, publication disabled on restore and explicit reconciliation without another operation request. These are tests with disposable values and intercepted browser transport, not physical-device, public deployment or durable-storage certification.

## Encrypted BackChat draft recovery

BackChat now has explicit encrypted `.reteam-chat-draft` export/import. It preserves text, thread ID, member and, for uncertain sends, both original operation and post IDs. The separate format cannot be confused with Board drafts or credentials. It uses the same AES-256-GCM/PBKDF2-SHA256 (600,000 iterations) envelope policy, randomized salt/nonce, authenticated destination, 12–1024-byte passphrase range and 100,000-byte file bound. Draft text is limited to 16,000 UTF-8 bytes and thread/member/operation/post IDs must be valid. It contains no session credential. Destination metadata remains visible.

Connect as the same member to the exact host/team. With no existing post draft, open **Encrypted BackChat draft recovery**, select the file, enter the passphrase and explicitly approve local restoration. An existing draft or unresolved send cannot be overwritten. Restoration clears send consent and requires explicit state loading. An unresolved restored send remains frozen; refresh reconciles only its exact post ID/actor/thread/text with no attachments/links, never automatically resending. Absence is not proof of rejection. Files do not grant access, prove commitment or revoke earlier sends. Preserve the file and consult the host if unresolved.

These are explicit download/import actions, not browser persistence or automatic reconnect. Verify saving and test restoration before leaving; keep strong passphrases separate. Oversized/invalid drafts cannot be exported in this format, and JavaScript cannot promise forensic zeroization. Plain text is encrypted in the file, but destination metadata is not. No private chat is read or uploaded.

The draft test suite checks roundtrip including both pending identities, randomized encryption, wrong pass/member/destination/format, malformed IDs, oversized text, empty pending content, schema/KDF/version and ciphertext tampering. Browser tests export an uncertain send, reconcile it, restore the encrypted copy, reject a wrong passphrase without any network request, require explicit state loading and reconcile again without creating a duplicate post. Browser transport is intercepted; these do not certify production infrastructure, power-loss safety, devices or automatic offline delivery.

## Reviewed BackChat Board references

BackChat's explicit state load now validates shared Boards as well as posts. In the composer, choose a loaded Board revision and optionally an item, then **Add reviewed Board reference**. Review the listed exact IDs/revisions with the text/thread before sharing. Selection/add/remove resets send consent. At most 64 distinct references are supported by the composer/draft file; historical post validation has not gained this new composer limit. No private local Board is read. Posted references display their recorded revision/optional item as plain text—not an implied navigable historical canvas.

Refreshing never upgrades references. If a Board revision or item no longer matches the loaded snapshot, publication is blocked until you explicitly remove and reselect it. A race after refresh is checked by the serialized host: stale/noncurrent Board links return HTTP 409 (a rejected operation), retain the draft and require fresh state/review. No force-follow-latest option or automatic merge is used.

Encrypted BackChat drafts preserve exact references along with both pending identities; link-free files from the prior checkpoint still restore. Restored unresolved sends reconcile against exact reference arrays as well as post ID/actor/thread/text. There is no resend triggered by restore. Draft schema validation rejects invalid revisions/item identities/duplicate links. Ordinary current code should not be used to open newer linked drafts in older unreleased builds that do not understand this optional field.

Evidence: browser tests cover Board/item selection, consent reset, exact submitted references, stale reference blocking/removal/reselection, and encrypted uncertain-send restoration/reconciliation with references. The disposable-CA TLS test creates a linked post and verifies stale-revision link rejection with HTTP 409 and no overwrite. The draft crypto tests roundtrip linked pending drafts and reject invalid/duplicate references. Attachments, historical canvas rendering, live sync and durable automatic outbox/reconnect remain unfinished. Earlier text-only checkpoint limitations about Board-link creation are superseded only by this section.

## Shared canvas continuation

The earlier note-only/read-only restrictions are superseded by the shared draft canvas documented in `teams-canvas-validation.md`. Existing image/PDF references are preserved and geometry-editable, but original upload/download/preview remains unfinished. Publication is still explicit whole-revision CAS, not live merge. Consult that document for concurrent-client and fault-test results; they are not a production stability guarantee.

## Bounded BackChat attachment continuation

BackChat now supports explicit file selection and reviewed binary upload, separately from sending a post. Select a nonempty file of at most 1 MiB, approve uploading its bytes to the trusted host, then upload. The returned team-scoped attachment ID is listed in the draft. Review text/thread/Board and attachment references and separately consent to posting. Up to eight distinct attachment references can be held by the composer/encrypted draft. Remove affects only the draft reference, not stored host bytes. Original filenames/MIME types are not retained by this protocol.

The dedicated authenticated HTTPS API adds `POST /attachments` with exact `application/octet-stream` and `GET /attachments/{64-hex-ID}`. Existing Host/origin/certificate/rate/admission/authentication rules apply. Viewer cannot upload; the core rechecks editor permission in its queue. Download is permitted to authenticated active members only for objects referenced by durable Team history, not arbitrary unreferenced uploads. Duplicate content may already be referenced: storage is team-scoped content addressed. The maximum transfer is the lower of host `limits.controlBytes` and 1,048,576 bytes. Keep the existing configuration explicit; operators with an 8 KiB control budget also have an 8 KiB attachment-transfer ceiling.

Binary input is read in bounded chunks with the existing request deadline, then buffered for encrypted immutable-object storage. Download decrypts through the core and sends an octet-stream with attachment Content-Disposition, no-store/nosniff and fixed neutral filename. This is **bounded binary transfer, not resumable or constant-memory large-file streaming**. The portable client checks response content type/size/destination, blocks redirects, omits cookies/referrer, obeys cancellation/timeouts and uses existing memory-only sessions. Its existing response budget can be lower than the server's ceiling. Client-supplied IDs do not prove byte hashes: IDs are keyed/team-scoped, and integrity is checked in the authenticated encrypted object store plus TLS.

Posted references offer explicit download-as-file. Bytes are never automatically previewed, rendered, executed, unzipped or fed to a model. Treat files as untrusted, inspect before opening and use OS security tools; no malware-scanning guarantee. Downloads use a neutral `.bin` extension and are only requests, not proof of saving. This milestone does not add image/PDF canvas upload/preview or preserve filenames/content types.

Encrypted BackChat drafts preserve attachment IDs, not original file bytes; they can recover successfully uploaded references. Uncertain-post reconciliation compares the exact attachment array as well as post identity/text/links. Upload errors/lost responses may leave an orphan object; the UI says so and does not create a post/retry. Files selected but not uploaded are memory-only and are not in encrypted drafts. Uploads are not transactional with posts, there is no user-facing orphan deletion/quota UI, and host backups may include unreferenced encrypted objects. Never treat disconnect or removing a reference as host deletion/revocation. There is no automatic offline delivery, resume or server-side antivirus.

Evidence: real disposable-CA TLS upload/readback, referenced-only access, Viewer-upload refusal/Viewer download, host/client size limits; browser upload consent and separate post consent, payload reference, download request, encrypted uncertain-send restore/reconciliation without duplicate posting; draft validation for invalid/duplicate/excessive references. Existing client/HTTPS/Teams suites and shared-canvas browser regressions pass. Browser tests use intercepted transport, not production infrastructure. Multi-gigabyte loads, physical devices, malformed-stream exhaustion fuzzing, Windows downloads and long-running quota/storage behavior remain unverified.
