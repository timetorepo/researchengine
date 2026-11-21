# Board summary mode — consented generation and fidelity review

Implemented 2026-11-12 on the existing working branch. Implementation checkpoint, **not a release/deployment or live-provider certification**.

## User flow

1. Select Board items, explicitly choose a configured model, enter the task and prepare the exact context as before. This makes no provider call.
2. Review the original context and enable the existing preparation consent. Choose **Prepare optional AI summary**. This opens a scrollable shared modal, not another cramped inspector form.
3. Review the exact generation request, pinned provider/model/endpoint and input/output budgets. A new, unchecked checkbox authorizes sending the selected original text and acknowledges possible charges.
4. **Generate consented summary** sends one request. It does not retry, switch models, use tools or automatically start analysis. Stop/close aborts; partial output is not acceptable context. Provider charges may still apply.
5. A successful response must contain one nonempty source brief per selected source. Unknown/duplicate/missing IDs, unsupported fields, unknown Board citations, malformed JSON or tool requests prevent acceptance. This validates structure and references, **not factual fidelity**.
6. Compare each source-level original with its editable brief. Review the exact derived downstream prompt and the estimated input comparison. Changing a brief resets fidelity consent. Empty/invalid/over-budget edits block acceptance.
7. A second checkbox explicitly accepts the lossy content after human fidelity review. **Use reviewed summary context** replaces only the prepared context, not the Board. The previous source context can be restored without a provider call while the setup remains open.
8. The existing create/configure consent is reset. Creating a snapshot session or configuring role models requires renewed review; actually sending the snapshot or executing agents still requires its existing separate confirmation.

No automatic summaries, silent truncation, recursive summary-of-summary compression, fake provider progress or use of default/free-routing substitutes.

## Context and provenance

- Generation uses selected source-level compact text/provenance, never whole-Board originals, hidden memory, canvas point arrays, image pixels or file bytes. PDF text is limited to the user's linked-page selection from preparation.
- Output is JSON with one `{id,text}` brief per included source. Source references are validated against the reviewed selection. The model is asked to preserve qualifications/numbers/disagreements and not claim access to missing originals; human review remains mandatory.
- Derived requests carry briefs and schema-controlled provenance: stable citations, item kind, URLs, linked PDF page/file identity and relevant relationships. Original evidence text/dictionaries are absent from downstream snapshot and assigned-agent payloads.
- Snapshots and MultiAgent evidence config retain a **local audit**: original system/prompt/source evidence, exact generation request, raw response, edited reviewed briefs, model/endpoint, generation usage and generation/acceptance timestamps. The audit is not part of stage input serialization. No secret/key field is collected.
- Summary text is marked as lossy derived evidence in the downstream system instructions and in each agent source. Reviewer/final agents continue to get public deliverables, not automatic copies of source material.
- Snapshot and agent views expose the local audit and show summary-generation usage separately from later session/stage usage. This feature does not encrypt browser chat storage or exports. An audit can retain text that the user removed from a brief; the UI explicitly discloses this.
- Original Board data is never edited by summary generation/acceptance. Closing an unaccepted modal discards the draft. Accepting into setup alone is not durable until a session/run is created through existing chat persistence.

## Cost, budgets and failure behaviour

- Generation is itself an additional provider request and may cost more than later savings. It is never described as guaranteed cheaper.
- Both original-generation and derived-context budgets use the established characters-divided-by-four estimate. They are not model tokenizers, provider context-window verification, exact-token caps or monetary caps. Provider output maximum is requested; total reported usage can differ.
- Budgets must be positive whole numbers. Input too large for the user's budget blocks before dispatch. Manual briefs too large for downstream input block acceptance, rather than being shortened.
- Changes to generation budgets discard the current draft and reset send/review consent; prior usage stays counted. Regeneration requires new consent and can incur another charge.
- Known usage is counted once in the daily budget even if output is unusable (format/fidelity/tool refusal). Partial/failed request usage is counted where the stream adapter supplies it; interrupted requests may have unknown charges.
- Model/endpoint availability, namespace/write-freeze, daily budget and privacy checks run before dispatch; key resolution is followed by another scope/pin/budget/privacy check. Closing/unmount aborts and prevents late draft state.
- Provider/network/format failure leaves the original prepared context usable. No automatic retries or endpoint/model fallback.

## Structured privacy follow-through

Testing found that serialized newlines could obscure a token boundary from a plain serialized-string secret scan. `reviewedOutboundWouldChange` now checks decoded JSON values as well as the outer string, using an iterative traversal and a 64-level nesting fail-closed bound. Private/Top Secret reviewed requests block instead of silently replacing source text; Privacy mode None remains an explicit bypass. Board snapshots additionally scan their source-level evidence, and MultiAgent checks its actual stage inputs.

This is heuristic secret-pattern checking, **not** an exhaustive data-loss-prevention/security certification. It does not scan local audits as if they were outgoing: the audit is deliberately not sent to downstream agents.

## Verification

- `frontend/scripts/board-summary-test.mts`: original text/exact request, source/output/citation validation, editable briefs, stable URL/PDF-page provenance, no original strings in derived payloads, immutable audit, oversized-input/edited-brief refusal, no recursive summaries, request mutation/invalid usage refusal, and agent serialization excluding the audit.
- Existing compact-context and nine grouped MultiAgent engine checks passed.
- `tools/design/check-board-summary.mjs`: full UI flow with intercepted Ollama-compatible responses. Covers no pre-consent request; exact selected sources/exclusions; changed-budget consent reset; 320px modal containment; editable fidelity reset; explicit acceptance/create/send; summary request plus separate analysis request; actual derived outbound payload without original sentinels; local audit/reload; restore original; malformed/missing/tool/refused responses; endpoint/model/Privacy Shield/daily-budget and changed-namespace generation/acceptance blocks; held real intercepted request plus Stop; no automatic retry; focus return; summary-to-agent config retaining local audit but only derived assigned sources. Also probes decoded JSON secret scanning, safe text, excessive nesting and explicit Privacy None.
- Existing Board-session (including PDF page/exclusions), Board-agent assignment, MultiAgent and eight-page spacing browser suites passed after integration. Those suites use stubs; no live provider interoperability/billing claim.
- Desktop fidelity-review, 320px modal and session-audit screenshots rendered and inspected in ignored `.cache/board-summary/`.
- Frontend TypeScript, root frontend/backend production build (frontend 45.60s in this sandbox) and `git diff --check` passed. Existing dynamic-import/oversized-chunk warnings remain. Build duration is not a runtime-performance claim.

Not tested: real model adherence/summary quality, real token/billing savings, native builds, screen readers, physical devices or provider cancellation guarantees. No supplied Gemini key, live/chargeable API call, new runtime dependency, deployment or release was used.

## Roadmap handoff

Consented summary-mode implementation is delivered. Next active milestone remains end-user Teams host/join, certificate trust, credential custody and explicit connection lifecycle; collaborative Board/BackChat and website are not implied complete. See `implementation-status.md`.
