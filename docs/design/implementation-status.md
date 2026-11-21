# Approved product roadmap — consolidated implementation status

Updated 2026-11-12. Working-branch implementation, **not a release or deployment**. This is the current roll-up; dated checkpoints in other proposals are historical and may describe gaps subsequently delivered. No percentage is assigned to unequal milestones.

## Roadmap

| Approved area | Implemented | Still required / limits |
| --- | --- | --- |
| Navigation / activity island | Collapsed tools, real import activities, islandcn integration, sidebar open/close treatment | Maintain regression/accessibility coverage; no universal device claim |
| Shared controls / BoardUI | All 14 requested component types have app consumers; original adapters on existing dependencies | Cold first-settings-open performance remains below the requested target in recorded measurements; exhaustive page/control polish and physical hardware evidence not complete |
| Glass / layouts / branding | Opt-in Glisse, material controls, layout/theme separation, saved sizing/pins, original identity and licensed fonts; Home and action Waves | Installer/native validation and exhaustive all-page accessibility/performance audit outstanding |
| Local Board | Notes/Markdown, references, image/PDF originals and linked-page previews, move/resize, frames/shapes/connectors/strokes, revision/recovery/undo, full backup/import, deletion/cleanup | Large-board performance, physical touch/pen, screen readers and crash/eviction certification remain unverified. Local browser storage is not encrypted Teams storage |
| Board → session / agents | Explicit models, reviewed immutable context, separate creation/execution consent; compact selected-only context and per-specialist evidence routing added in the current pass | Optional AI-assisted summary mode still outstanding; no live-provider/tokenizer/billing validation. Existing single-session follow-ups still include their full retained history; nothing silently discarded |
| Bounded MultiAgent | Explicit leader/specialist/reviewer models, limits, cancellation, public deliverables, disagreements, Council preservation; explicit Board source assignments now supported | No live provider/native certification. Controlled patches/tools/writes are deliberately unavailable, not implicitly enabled by approval to finish integration |
| Teams core | Encrypted journal/objects, recovery tooling, roles, credentials/invitations, persisted client outbox and conflicts, HTTPS server transport, client/onboarding boundary | End-user host/join and certificate-trust UX, packaged credential file/OS custody, lifecycle ownership, attachment streaming and application integration remain unfinished |
| Collaborative Board / Teams BackChat | Durable typed operations/replay and transport primitives underpinning future integration | No finished collaborative Board or Teams-only BackChat UI/sync. Reconnect/conflict/attachment end-to-end application and recovery verification required |
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
- No provider-generated summary has been implemented or invoked. That approved mode remains a follow-up, with explicit cost/consent and fidelity review required.

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

## Active remaining work — no new approval requested

1. Finish optional consented summary-mode implementation and fidelity/cost review; broader Board/agent validation.
2. Finish Teams host/join, secure credential custody and explicit connection lifecycle before claiming end-user availability.
3. Integrate collaborative Board, attachment transfer and Teams-only BackChat with reconnect/conflict/recovery verification.
4. Complete remaining MultiAgent integration/validation and measured cold-start/performance follow-through; flag chargeable live tests before running them.
5. Rebuild website/isolated labelled demo from implemented features, then final cross-product regression, release notes and authorized release preparation.

The spacing pass is a bounded correction, not completion of every screen/state or of the unfinished collaboration/website milestones. These remain active work rather than dropped scope.
