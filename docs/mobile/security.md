# security.md — every dependency that can see the network, and what it sees

Brief §10's list-file. Rule: a new dependency that touches the network without a
row here fails review. (No ad SDKs, no analytics SDKs, no crash reporter that
phones home — mobile's dependency allowlist is *smaller* than desktop's, which
already has none of the above.)

## Today, desktop (verified in this checkout)

| Component | Network? | What it can see |
|---|---|---|
| `backend/src/routes/chat.ts` | yes, to provider `baseUrl` you configured | the prompt/messages incl. image dataUrls; `maskSecrets` applied to error surfaces; request bodies never logged |
| `backend/src/routes/search.ts` + `services/search/adapters.ts` | yes, to searxng/brave/serper/tavily/DDG | the query string only; Top Secret forces `offline=1` (demo results, zero external requests) |
| `backend/src/routes/providers.ts` | yes | key + model-list request to provider; response cached in `settings.providerModels` |
| `backend/src/routes/ollama.ts` | localhost | model tags |
| `backend/src/routes/integrations.ts` | yes (stub: oauth start/callback pending map) | nothing real yet — flag as **stub** in parity §1 |
| `backend/src/routes/mcp.ts` | spawns local processes; servers themselves decide | tool names/args; env used, never logged; kill after call |
| `frontend/src/lib/providers/stream.ts` | direct browser→provider in BYOK mode | same as chat route |
| `frontend/src/lib/articles/images.ts` | Wikimedia Commons API | the image search query; never the document text |
| `frontend/public/sw.js` | no API caching by design (comment: "API calls are never cached") | — |

## Mobile (as of this file's date: R1 target state)

| Mobile dependency | Network? | Sees |
|---|---|---|
| `crates/re-net` (provider calls, companion transport) | the only mobile module allowed to open sockets | provider traffic as above, gated by Privacy Shield **at this layer** (the enforcement point the brief demands: outside the UI, at the byte boundary); companion channel pinned TLS 1.3 (SPKI), scopes as paired |
| `crates/re-fs` importers (pdf/DOCX/OCR) | no | local files only |
| `crates/re-models` (llama.cpp/MLX/NNAPI bindings) | download-time only, user-initiated, resumable, digest-verified, cellular-paused default | model host (user-configured list), nothing else; inference is offline by construction |
| OS model APIs (Apple on-device, AICore) | none for on-device paths | OS-level: as the platform documents |
| Search lanes (documents → Wikipedia → trusted) | Wikipedia adapter = the query; local lane = none | documented per-lane; every lane reports `why()` when it fails |
| Sentry/crash reporting/telemetry | **prohibited** | — |
| Fonts (@fontsource Geist, bundled) | none (bundled) | — |

## Threat decisions carried into code

1. Keys: never in WebView storage (`localStorage` ban enforced by CSP + the fact
   that mobile stores keys in Keychain/Keystore via `re-core`; the desktop's
   localStorage+AES-GCM vault (`lib/crypto/vault.ts`) is explicitly *not* the
   mobile design).
2. Library at rest: encrypted (SQLCipher in `re-core`, key in secure store); the
   user can read the folder path in You → Advanced; files are not readable without
   the device unlock.
3. App-switcher snapshot: blurred by default (platform APIs), with a setting.
4. Companion: scopes individually granted; `coding.exec` needs a 60 s second
   confirmation *per execution*; revocation both ways; pairing secret single-use,
   3-minute expiry; the relay is opt-in, E2E, self-hostable, and the UI states
   what metadata leaves (brief §4.3 verbatim behaviour).
5. Export stays first-class: ZIP (store→folder-scoped once R2 moves state into
   SQLite; today's store-scoped ZIP in `DataTab.tsx` is the interim format,
   versioned `version: 2` field already).
