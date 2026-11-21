# Approved product roadmap — consolidated implementation status

Updated 2026-11-12. Working-branch implementation, **not a release or deployment**. This is the current roll-up; dated checkpoints in other proposals are historical and may describe gaps subsequently delivered. No percentage is assigned to unequal milestones.

## Roadmap

| Approved area | Implemented | Still required / limits |
| --- | --- | --- |
| Navigation / activity island | Collapsed tools, real import activities, islandcn integration, sidebar open/close treatment | Maintain regression/accessibility coverage; no universal device claim |
| Shared controls / BoardUI | All 14 requested component types have app consumers; original adapters on existing dependencies | Cold first-settings-open performance remains below the requested target in recorded measurements; exhaustive page/control polish and physical hardware evidence not complete |
| Glass / layouts / branding | Opt-in Glisse, material controls, layout/theme separation, saved sizing/pins, original identity and licensed fonts; Home and action Waves | Installer/native validation and exhaustive all-page accessibility/performance audit outstanding |
| Local Board | Notes/Markdown, references, image/PDF originals and linked-page previews, move/resize, frames/shapes/connectors/strokes, revision/recovery/undo, full backup/import, deletion/cleanup | Large-board performance, physical touch/pen, screen readers and crash/eviction certification remain unverified. Local browser storage is not encrypted Teams storage |
| Board → session / agents | Explicit models, reviewed immutable context, separate creation/execution consent; compact selected-only context, per-specialist evidence routing and consented/reviewed AI brief mode | Summary implementation delivered; no live-provider/tokenizer/billing validation. Existing single-session follow-ups still include their full retained history; nothing silently discarded |
| Bounded MultiAgent | Explicit leader/specialist/reviewer models, limits, cancellation, public deliverables, disagreements, Council preservation; explicit Board source assignments now supported | No live provider/native certification. Controlled patches/tools/writes are deliberately unavailable, not implicitly enabled by approval to finish integration |
| Teams core | Encrypted journal/objects, recovery tooling, roles, credentials/invitations, persisted client outbox/conflicts, HTTPS transport; routed explicit join/reconnect/counts and portable encrypted credential UI; trusted-local host lifecycle CLI and Owner conversion | In-app hosting/access/recovery wizard, OS certificate/keychain custody, assembled/native packaging validation, attachment streaming and collaborative application integration remain unfinished |
| Collaborative Board / Teams BackChat | Durable typed operations/replay; Teams-only text post UI with explicit load/send, role gating, rejected drafts and in-memory uncertain-post reconciliation | Collaborative Board editor, BackChat attachments/Board-link creation, durable outbox/reconnect/conflict/recovery integration remain unfinished; text BackChat is explicit snapshots, not live sync |
| Website / labelled demo | Existing brand/artwork/reference research | Approved website replacement and isolated demo remain unfinished; no deployment |

Teams' last recorded infrastructure checkpoint is **113 grouped checks** at `8268a53`, not rerun by the current frontend pass. It is not a claim of usable end-user Teams or host-blind E2EE. An authorized host can read plaintext.

## Current completed implementation pass

### Board context economy

- Preparation defaults to the selected item, or no items if none is selected. Whole-Board inclusion is an explicit action. Frame contents are not silently included.
- Compact evidence is the default. Full item metadata/geometry is still an explicit alternative. Existing stored snapshot prompts are not rewritten.
- Selected note/annotation text is preserved verbatim, including Markdown, whitespace and long endings. Stable citations, membership/endpoints, URL and linked PDF-page provenance remain; layout geometry, drawing point arrays and original file bytes are not agent evidence.
- Exact duplicate strings and repeated linked-page originals are pooled in dictionaries; PDF extraction and attachment loading are reused per selected attachment/page during a preparation. No inferred summaries, fuzzy deduplication, retrieval guesses or silent truncation.
- Review shows the exact prompt and selected-context estimated input compared with full metadata for the **same selected items**. Characters ÷ 4 is a heuristic, not a provider tokenizer or billing quote. Compact dictionaries can add overhead for tiny contexts; savings are not guaranteed.
- Reviewed evidence can open **Configure agents with this evidence** in a proper modal, not a full agent form crammed into the Board inspector. Explicit role models and a second execution consent remain required.
- Users assign sources separately per specialist. Initially specialist 1 has the selected evidence; specialist 2 has none until explicitly assigned. Planning gets the task only. Reviewer/final stages receive public work products, not another automatic copy of the original Board. A stage without originals is instructed not to claim direct verification.
- Per-specialist task/evidence estimates are shown, explicitly excluding system instructions and the future leader plan. Actual stage reservations still use the complete serialized request. Over-budget input blocks; no clipping/fallback.
- The follow-up [consented summary-mode checkpoint](board-summary-mode.md) is now implemented: optional additional provider call, source-level validation/editable fidelity review, restored originals, explicit acceptance and local audit. Only intercepted-provider tests were run; no live summary or paid test was invoked.

### Spacing and containment

- Shared compact browsing-page gutter for Chats, Library and Marketplace; less excessive top/bottom whitespace.
- Home: reduced plain-hero minimum height and gap above the composer; top offset capped rather than 9vh. Optional artwork retains its separate presentation.
- Chats: search near its heading/counts, wrapped header metadata and smaller section gaps; list/table and density preferences retained.
- Marketplace: section tabs now wrap at narrow widths. The new containment test caught the previous overrun at 390px; fixed rather than clipped.
- Settings: reduced desktop internal padding and switch gap, left-aligned content container, long text wrapping. Native/keyboard controls retained.
- Board: tighter list/empty-state padding, title no longer stretches Save controls across the entire toolbar, grouped context actions, long-label wrapping; intentional canvas pan/zoom preserved.
- MultiAgent: responsive role/brief grids, tighter grouped budget fields, bounded evidence lists and a shared modal with scroll/focus/Escape behaviour.

## Verification in this pass

- Frontend TypeScript passed. Root production build passed for frontend (final build 48.19s in this sandbox) and backend; existing dynamic-import/oversized-chunk warnings remain. `git diff --check` passed. These are build results, not runtime performance measurements.
- `frontend/scripts/board-context-test.mts`: exact text/Markdown and source/relationship preservation, pooling, omission of geometry/bytes, no mutation. Fixture serialized characters **12,126 → 866**; synthetic drawing-heavy fixture, not a billing claim.
- `frontend/scripts/multi-agent-test.mts`: **9** grouped fake-adapter checks including per-specialist source separation, missing/duplicate assignment rejection and budget refusal before sending oversized evidence.
- `tools/design/check-board-agent-context.mjs`: selected-only default; explicit whole/exclusions; compact/full text retention; no provider calls during preparation/setup; source assignment, actual mocked requests, five-stage run/reload without replay; 390px modal containment, focus inside modal, Escape and focus return. Drawing-heavy fixture estimated selected input **4,021 → 349**, not measured provider tokens or universal savings.
- `check-board-session.mjs`: prior model/consent/PDF/failure/privacy/budget/history tests retained; now explicitly includes whole Board in the fixture, plus repeated-page probe verifying one original load, two citations and one pooled page text.
- `check-page-spacing.mjs`: before/after captures for Home, Chats, Library, Marketplace, Board list/editor, MultiAgent and Appearance at **1440, 390 and 320px**; after checks document/content horizontal bounds with long titles/tasks. Separate **200% CSS zoom stress probe**, not actual browser-zoom or physical-device certification. Settings/Marketplace fixtures include disconnected/empty states, not connected external accounts. Does not certify every tab/populated state.
- Existing `check-multi-agent.mjs`, `check-board-workspace.mjs`, `check-action-waves.mjs` and `check-settings.mjs` passed.
- Screenshots inspected in ignored `.cache/page-spacing/{before,after}` and `.cache/board-agent-context` folders.
- The earlier workspace timeout is diagnosed and resolved in its test: reduced motion intentionally renders standard links, so expecting a Glisse glass element was stale. The suite now asserts that fallback first, then explicitly enables motion for glass assertions. `check-workspace.mjs` passes in full, including populated layout/history, density, resizing, persistence, material, active-chat exclusions and narrow bounds. No production navigation override was made.

No supplied Gemini key, paid/live provider calls, external account integration, new runtime dependency, release or deployment.

## Summary-mode follow-up checkpoint

See [board-summary-mode.md](board-summary-mode.md) for the full behaviour/limits.

- Implemented separate generation cost consent, pinned request review/budgets, one brief per source, editable fidelity review, exact derived context and acceptance consent, restored originals, and local generation/original-evidence audit.
- Accepted briefs can seed sessions or per-specialist agent assignments. Only derived context/provenance is serialized to downstream requests; the local audit is retained separately. Generation usage is shown/counts separately; not a guarantee of lower total cost.
- Added decoded-JSON privacy checking to reviewed Board/agent payloads after a serialized-newline test exposed a plain-string boundary gap. Explicit Privacy None still applies; this is heuristic scanning, not DLP certification.
- New pure summary contract tests and mocked browser summary tests passed, including actual intercepted generation/analysis payload separation, validation/errors/cancellation/consent/focus/reload/original restore and 320px rendering. Existing Board-session, Board-agent, MultiAgent and page-spacing regressions passed. Frontend TypeScript and root production build passed (frontend 45.60s in this sandbox; backend bundle passed); existing dynamic-import/chunk-size warnings remain. `git diff --check` passed. No live provider call or physical-device certification.

## Active remaining work — no new approval requested

1. Finish Teams host/join, secure credential custody and explicit connection lifecycle before claiming end-user availability.
2. Integrate collaborative Board, attachment transfer and Teams-only BackChat with reconnect/conflict/recovery verification.
3. Complete remaining MultiAgent integration/validation and measured cold-start/performance follow-through; flag chargeable live tests before running them. Live summary quality/token/billing validation remains unperformed, not a reason to silently call a real provider.
4. Rebuild website/isolated labelled demo from implemented features, then final cross-product regression, release notes and authorized release preparation.

The spacing and summary passes are bounded implementations, not completion of every screen/state or of the unfinished collaboration/website milestones. These remain active work rather than dropped scope.

## Teams connection / operator continuation

See `../teams-host-and-join.md` for the implemented portable-custody/join and explicit local host lifecycle checkpoint, commands, evidence and limitations. Real disposable-CA local TLS and built CLI stop/restart tests pass; browser join/custody tests use intercepted transport. This does not supersede the unfinished collaborative Board/BackChat, native custody, full accessibility/performance, website/demo and release rows above. No deployment or release.
