# Teams client transport and credential onboarding

Implementation checkpoint; not a released host/join UI. No listener, connection, file import, storage write or background retry occurs by importing these modules.

## Portable boundary

`shared/teams/client.ts` (frontend re-export `frontend/src/lib/teams/client.ts`) supplies:

- `TeamJoin.prepare(endpoint, invitation, options)` validates a canonical HTTPS origin/team and single-use invitation without network IO. `review()` describes host trust and lost-response risk without returning the invitation. `confirm()` requires exact reviewed origin/team and explicit host-trust/single-use acceptance. Exactly one redemption attempt; uncertain outcomes require operator review, not automatic retries. Cancel before dispatch drops the held token.
- `TeamClient.fromSession()` validates an in-memory session, its team-bound credential digest, expiry and receipt. `resolveClientSession()` resolves imported actor/role against the explicitly selected HTTPS host. Actor names are not guessed from Owner artifact filenames.
- `read()`, `submit()` and `queueTransport()` implement bounded JSON control requests, actor binding, stable operation IDs/receipts and the existing durable outbox contract. Content operations only; no access mutation injection. 409 becomes a retained conflict; transport failures stay uncertain/deferred, not false acknowledgements. No attachment upload/download endpoints exist yet.
- Explicit request deadlines, AbortSignal/disconnect cancellation, response byte ceilings including streamed bodies, redirect rejection, no cookies/referrer/cache, sanitized errors. Native marker only when explicitly configured; browser Origin remains under browser control. HTTPS trust is the platform's normal certificate validation; no bypass or certificate-warning suppression.
- `persistCredential(writer)` is an explicit credential-bearing integration seam, not automatic storage. Only reviewed local encrypted custody adapters may receive it. `disconnect()` aborts outstanding requests and drops the client session reference; it does not revoke the host session. JavaScript strings cannot be reliably zeroized.

Options require explicit timeout/response budgets and native/browser policy. Fetch injection is a trusted test/platform adapter boundary, **not** a plugin/provider hook; a malicious injected adapter can read credentials. Browser callers use the platform fetch and platform TLS trust. No URL query credentials or localStorage persistence.

## Encrypted local custody

`backend/src/teams/client-credential.ts` seals/unlocks bounded client artifacts using existing scrypt-N32768-r8-p1 key derivation and AES-256-GCM. AAD binds version, origin, team and salt. Unlock requires the separately reviewed exact destination and revalidates session scope/expiry. Wrong passphrase, tampering and destination changes fail closed with generic errors. Buffers holding temporary key/plaintext/password copies are cleared; caller-owned buffers remain caller responsibility.

`importOwnerClient()` unlocks the existing Owner artifact, then resolves authenticated identity against the supplied trusted HTTPS host. The caller must review that origin first: the legacy Owner artifact binds team, not server origin. This method does not magically authenticate a hostname or approve network exposure. No recovery/bootstrap token is sent to the host.

Modules return encrypted bytes rather than writing them. Existing explicit local operator/file custody must provide private permissions and atomic publication. No browser passphrase/scrypt polyfill or native keychain is claimed. A joined client can hand its session directly to `sealClientCredential` through `persistCredential` without exposing it to UI state. Existing encrypted outbox remains the persistence layer for pending operations; nothing starts a drain automatically.

## Verification and remaining work

Client tests cover no-network review, exact consent, single dispatch, sanitized uncertain failures, strict response budgets, scoped sessions, actor/receipt checks, outbox adapter typing, encrypted round-trip/wrong-passphrase/destination/tamper rejection and disconnect. The actual local HTTPS suite also joins through the client, commits/retries a real operation, seals/restores the joined client and resolves Owner identity with a verified generated test CA. Its test-only request routing uses node HTTPS and a local CA, not production trust bypass.

Remaining: packaged credential file import and OS custody integration, explicit host/join UI and certificate-trust UX, automatic lifecycle ownership only after explicit connect, browser-origin CORS deployment validation, native/device testing, attachment streaming and resource/fault/security review. No claim that this checkpoint is end-user-ready Teams, host-blind E2EE, or durable browser credential storage. Design changes remain proposal-only.
