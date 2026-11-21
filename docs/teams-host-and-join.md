# Teams host, join and portable custody checkpoint

Working branch, 2026-11-12; not a release or deployment. This is a connection and local-operator milestone, **not completed collaboration**. The `/teams` page reads shared-state counts and has an explicitly loaded Teams-only text BackChat. It does not edit collaborative Boards. A trusted authorized host can read shared plaintext; this is not host-blind E2EE.

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

Existing offline backup/verify/restore/Owner-recovery procedures remain in `teams-offline-recovery.md`. Preserve keyring/data/credential backups and test recovery offline. Host certificate installation, native custody, in-app host wizard/access administration/recovery, attachment streaming, shared Board editor, BackChat attachments/Board-link creation and durable reconnect/conflict integration remain unfinished. Owner invitations currently require stopped-host CLI operations; no UI access-management claim.

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
