# Dedicated Teams HTTPS control-plane transport (unreleased)

`backend/src/teams/https.ts` wraps an already-open, permission-enforced `TeamHost`
in a separate Node HTTPS server. It is not imported by the main app, mounted on
its `/api` router, started by `npm start`, or exposed by the offline operator CLI.
No listener remains running after the tests. Host/join UI and packaged hosting
are not delivered by this source-library checkpoint.

## Explicit startup contract

`createTeamHttpsServer(host, options)` constructs without listening.
`startTeamHttps(host, options)` explicitly binds and returns the server. The
caller owns listener shutdown and must stop accepting/drain requests before
closing the host. No certificate generation, CA installation, tunnel, rendezvous,
UPnP, DNS discovery, HTTP fallback or public deployment is performed.

Required configuration:

| Field | Contract |
| --- | --- |
| `confirmNetworkExposure` | Must be exactly `true`; no implicit startup consent. |
| `bind`, `port` | Explicit IP address and port; no hostname/default bind. Port zero supports ephemeral tests. |
| `publicOrigin` | One canonical HTTPS origin. Every Host header must exactly match its authority. |
| `allowedOrigins` | Nonempty exact canonical HTTPS UI-origin allowlist; no wildcard, HTTP or `null`. |
| `cert`, `key` | Explicit PEM buffers. Leaf must be currently valid for advertised hostname/IP; key/certificate parsing uses Node TLS. |
| `allowNativeClients` | Explicit policy. Without Origin, clients also need `X-RE-Team-Client: native-v1`; a supplied untrusted Origin is never bypassed. |
| `limits.controlBytes` | Operator-selected JSON control-message budget; over-budget data is rejected, never truncated. |
| `limits.activeRequests` | Positive concurrent-handler and socket-connection budget. Idle connections consume socket capacity. |
| `limits.requestsPerMinute` | Positive per-peer-IP request budget, including preflight/redemption. |
| `limits.trackedClients` | Positive bounded rate-window table size; new peers are rejected while full. |
| `limits.requestTimeoutMs` | Positive bounded request/socket deadline; incomplete bodies and slow work do not retain the client indefinitely. |

There are no arbitrary attachment-upload size limits here: there is **no binary
upload endpoint** yet. Control JSON, including full Board replacements, must fit
the explicitly configured budget or fail. Streaming attachments, transfer quotas,
pagination/deltas and bounded-state response processing remain future work.
Whole-state reads and the host's whole-history replay still impose memory/CPU
limits; do not treat these controls as production DoS/security certification.

TLS minimum is 1.2 using Node defaults, with direct TLS only. Clients must verify
the server certificate against an explicitly trusted CA/browser trust store.
Never disable certificate checks to make a LAN certificate work. The test suite
generates disposable certificates and passes their CA explicitly; it also proves
that the same server is rejected without trust. Browser/physical LAN certificate
installation, native platforms and multi-device behavior are not certified.

`Host`, Origin and actual peer address are used directly; forwarded host/proto/IP
headers do not grant trust or bypass rate limits. Reverse-proxy termination/peer
identity support requires a separate explicit design. NAT clients share a budget.
Origin policy is browser CSRF/CORS defense, not native-client authentication.
Every protected method still requires a valid scoped bearer and current role.

## Control-plane API

All paths begin `/v1/teams/{exactTeamId}`. No credentials are allowed in query
strings. Session credentials use `Authorization: Bearer ...`; invite redemption
uses an exact JSON body. Raw tokens are sensitive even though HTTPS encrypts
transit. No cookies, credentialed wildcard CORS, local-filesystem APIs, Owner
bootstrap or trusted-local Owner recovery endpoint exists.

| Method/path suffix | Body / purpose |
| --- | --- |
| `GET /state` | Sanitized shared state, authenticated member ID and current role; no session/access records. |
| `GET /access` | Owner/Admin inspection of access metadata. |
| `POST /operations` | `{operation}`; content kinds only, matching authenticated actor; durable receipt and operation ID. |
| `POST /invites` | `{role,durationMs,sessionDurationMs}`; issuer permissions apply; returns one raw invitation to authorized caller. |
| `POST /invites/redeem` | `{invitation}`; capability redemption, no existing bearer required; returns one scoped onboarding credential. |
| `POST /invites/revoke` | `{digest}`; Owner/all or Admin/own grants only. |
| `POST /members` | `{member,role,active}`; core Owner/Admin boundaries apply. |
| `POST /sessions/issue` | `{member,durationMs}`; credential issuance restrictions apply. |
| `POST /sessions/revoke` | `{digest}`; self/administrative revocation restrictions apply. |

POST bodies require `application/json`, valid UTF-8 and exact documented fields;
compressed bodies are not accepted. Methods are GET/POST plus constrained CORS
OPTIONS. Invalid/missing origin/host, credentials, shape or permissions fail
closed. Core authentication is repeated inside its serialized queue and before
append; adapter admission does not freeze permissions against queued revocation.
Errors expose fixed codes, not raw parser/crypto/filesystem errors or request data.

Responses use no-store/no-cache, nosniff, no-referrer and restrictive content
policy headers. Trusted Origin is echoed exactly with `Vary: Origin`; untrusted
origins never receive allow-origin. The module emits no request/secret logs.
External proxies/caller logging remain the operator's responsibility.

Deadlines/disconnects do **not** roll back a host commit. Content clients retain
pending operations and retry the same ID. A lost invitation/redemption/session
issuance response follows the existing explicit recovery rules; do not mint
replacement secrets automatically or assume an HTTP failure means no commit.
Timed-out host work retains handler capacity until it actually settles, preventing
an unlimited hidden queue. No automatic reconnect, request retry or model call
is performed by the transport.

## Verification and next steps

`teams-https-test.ts` uses actual temporary local TLS listeners and disposable
certificates, with no external calls or real user credentials. It covers config
consent/HTTPS/cert/allowlist refusal, trusted vs untrusted certificate and plaintext
rejection, Host/origin/native policy, CORS preflight, bearer/role/actor checks,
durable content retries/revision conflicts, exact/bounded JSON including chunked
oversize, concurrent single-use onboarding/revocation, peer-IP rate limiting and
slow-body deadlines. All listeners/files are closed/removed afterward.

Next: a client adapter that preserves these trust/error/idempotence rules,
browser/desktop persistence and secure onboarding/credential delivery, then
visible host/join consent/configuration. Binary attachment transport and broader
resource/fault testing are still required before general collaborative use.
