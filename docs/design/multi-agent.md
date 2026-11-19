# Bounded MultiAgent — first implementation checkpoint

Implemented 2026-11-12. Unreleased; no live provider validation.

## Scope

The active Council composer action and Models settings panel are replaced with a separate MultiAgent setup. Existing Council chats, result data, configuration and legacy implementation remain intact. Native model effort preferences are not changed.

The fixed graph is leader plan → one or two specialist work products → reviewer disagreements → leader final. All three role models must be explicitly selected from configured providers/models; the same model may serve multiple roles. Model IDs and endpoint identities are pinned. Missing/changed providers, keys or endpoints fail without substitution. Creation requires review consent; execution requires separate consent. Existing chats, memories, Board data and attachments are not automatically imported.

Maximum calls: 1–5; specialist concurrency: 1–2. Input estimates use characters divided by four. Before each request the engine reserves estimated input plus requested output maximum against the run budget. Input, total-run and call ceilings block further stages instead of truncating inputs. Actual provider usage can exceed estimates: **this is not an exact-token or monetary cap**. Provider output limits still apply. Actual reported usage is retained where available, otherwise estimates are labelled; interrupted requests can have incomplete charges/usage. Stage attempts are not represented as billable requests.

No tools, search, recursion, retry, fallback, automatic patches, Board writes or file writes. Public work products and exact stage requests are inspectable through SortUI Trace; no private chain-of-thought is requested/displayed. The reviewer explicitly reports disagreement, and the final leader must address corrections and unresolved issues. A failure blocks downstream synthesis. Stop/unmount abort active requests; completed/partial results remain. Reload does not auto-resume or retry. Final assistant messages are created only on success.

Privacy Shield changes block rather than silently rewriting the task/deliverables. Provider calls use exact system prompts and same-origin Ollama proxy routing, not generic chat orchestration. Local namespace/write-freeze checks gate persistence and provider dispatch. Persistence uses existing deferred local chat storage, **not** a transaction journal, process-kill recovery protocol or Teams durability guarantee.

## Verification

- `frontend/scripts/multi-agent-test.mts`: 8 fake-adapter checks passed: DAG/dependencies/immutable events, concurrency 1/2, calls, input/run reservations, actual spend overrun, partial failure usage, concurrent cancellation, invalid configuration/usage.
- `tools/design/check-multi-agent.mjs`: mocked browser checks passed for composer replacement/draft preservation, explicit roles/two confirmations, DAG/concurrency, exact payloads/no tools/native effort, review/final sharing, usage accounting, Council preservation, reload/no resume, call-limit failure, concurrent Stop, reviewer refusal/no fallback, changed endpoint blocking, 390px overflow. No external requests or page errors.
- Desktop 1440×1000 and narrow 390×844 captures visually inspected. Reading results use stable surfaces; configuration/results are semantic labels, buttons and disclosures.
- Existing Board-session and settings-search browser regressions passed.
- Frontend TypeScript and frontend/backend production builds passed; existing bundle-size warnings remain.

Not validated: live provider behavior/billing, native builds, physical devices, screen-reader operation, process-kill durability, collaborative/Teams execution. Controlled patch proposal/review/apply is deliberately not enabled in this first pass; tools/writes remain unavailable. No release or deployment performed.
