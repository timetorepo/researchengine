# Fonts, AI Trace and brand tag — research / proposed next batch

2026-11-12. Research and proposal only: no UI change, new dependency, font installation or release. Await approval before implementing these new UI additions. Continue the previously approved roadmap independently.

## Fonts

- SN Pro: recommended optional UI/Board reading typeface, not an automatic default replacement. Official supernotes/sn-pro at e025ac4755352167a4b160bfb77c72068b04b55c, SIL OFL 1.1 verified from OFL.txt. Upstream describes Markdown-oriented design based on Nunito. If approved, self-host normal/italic variable WOFF2 and retain upstream licence/copyright; compare actual small controls, long text, symbols and numbers before promoting. Preserve existing saved typeface choices and existing brand fonts. Source: https://github.com/supernotes/sn-pro .
- Cera Round: TypeMates commercial font. Official EULA is media-specific (desktop/web/apps etc.), restricts sharing/extractability and is not permission to redistribute font files in a public MIT repository. Do not obtain font mirrors or assume a desktop purchase covers our distribution. Keep as a visual reference unless explicit distribution-compatible rights are obtained. Sources: https://www.typemates.com/de/fonts/cera-round , https://www.typemates.com/licences/commercial .
- NDot: exact file/version/rights unresolved. Third-party metadata for Nothing Ndot 57 says Nothing-brand-only; not enough official evidence to approve use here. Do not bundle, trace glyphs or use fan clones as a licensing workaround. Ask for the exact official source if the user wants that particular font. For an independently licensed dot-display alternative, Google Fonts ofl/doto/OFL.txt identifies the Doto Project Authors and SIL OFL 1.1: https://github.com/google/fonts/tree/main/ofl/doto . Proposed use is sparse display labels/marketing, not dense text or code. No font added yet.

## SortUI Trace

User reference: https://sortui.dev/docs/components/trace . Reviewed actual public source, not Pro content:

- https://github.com/sortui/ui/tree/664a42e05aef13fee59c8da5209eef3ef9a84d4f
- components/ui/trace.tsx and components/ui/collapsible.tsx; MIT copyright 2026 SortUI verified in LICENSE.
- Registry https://sortui.dev/r/trace.json is public. Source uses cn, lucide and Base UI collapsible. Reuse our installed clsx/cn equivalent and Base UI; no unreviewed CLI execution or competing UI stack.

Proposed integration: source-owned actual Trace/line/icon/title/description/collapsible anatomy with retained MIT attribution. Replace chat ToolTraceChips / BoardTaskList presentation at the existing tool-activity call site rather than add a duplicate log. Feed recorded ToolActivity and legacy toolTrace data; do not rewrite saved transcripts. Expandable history should expose statuses, resource labels, recorded timings and available safe summaries; distinguish missing data from measured data. Preserve approval/questionnaire/graph controls and all error/blocked/cancelled states. Do not infer success from stream completion, invent durations, expose secret tool arguments/raw output or add private chain-of-thought displays. Verify long lists, long resource names, keyboard disclosure, forced colours and app/OS reduced motion. MultiAgent can later share the same public event view without claiming its orchestration is implemented now.

## AlternativeTo discoveries: shortlist, not integration approval

Discovery listings are useful for product references, not a licence authority. Repository terms were separately checked where stated. Hosted paid extras and individual packages/assets need their own review.

| Paid/commercial category | Discovery | Useful angle for ResearchEngine | Reuse posture |
| --- | --- | --- | --- |
| Miro / whiteboards | Excalidraw | selection, connectors, keyboard operations, portable board files | Root MIT verified. Candidate for later scoped package review, not installed. https://github.com/excalidraw/excalidraw/blob/master/LICENSE |
| Slack / team chat | Zulip | topic-first threads, unread state, async conversation navigation | Root Apache-2.0 verified. Behavioural reference for Teams-only BackChat, not an embedded server. https://github.com/zulip/zulip/blob/main/LICENSE |
| Figma / design | Penpot | frames, inspector hierarchy, design/marketing workflow | Root MPL-2.0 verified; use as external tool/reference, no source copied. https://github.com/penpot/penpot/blob/develop/LICENSE |
| Notion / workspace | AppFlowy | document/board relationship and offline editing workflow | Root AGPL-3.0 verified. Behavioural reference only under the user's no-AGPL-copying constraint. https://github.com/AppFlowy-IO/AppFlowy/blob/main/LICENSE |
| Mendeley / reference managers | Zotero | citation metadata, attachment provenance, source-to-page navigation | COPYING explicitly AGPLv3 (GitHub detection NOASSERTION is not a licence). No app-source copying. Consider independently specified import/export workflows later. https://github.com/zotero/zotero/blob/main/COPYING |

Discovery pages:
- https://alternativeto.net/software/miro--formerly-realtimeboard/?feature=whiteboard&license=opensource
- https://alternativeto.net/software/slack/?platform=self-hosted
- https://alternativeto.net/software/figma/?license=free
- https://alternativeto.net/software/notion/?license=free&platform=self-hosted
- https://alternativeto.net/software/mendeley/

Also surfaced Plane (AGPL-3.0 listing), PDF Arranger/Stirling PDF and AFFiNE. Not shortlisted for code reuse: avoid redundant project-management scope, unverified edition-specific rights and conflicting directory licence labels. No pricing or security guarantees inferred from listings.

## Brand tag direction to approve

The attached reference suggests an almost-black field, oversized identity, compact uppercase monospaced metadata, generous negative space and a right-side stamp. Adapt that composition originally using the selected ResearchEngine symbol; do not copy Acre's mark, wording, coordinates/domain or registered-trademark symbol. Do not imply ResearchEngine is a registered trademark or invent an office address.

Proposed editorial signature: selected RE symbol / RESEARCHENGINE / RESEARCH · BUILD · CREATE / OPEN-SOURCE WORKSPACE / small RE—01 edition block. Monochrome white-on-graphite and inverse warm-paper versions of the same artwork. SVG and PNG exports, with outlined/licence-safe typography for reliable static rendering, and a restrained website/download-footer placement later. This is a supporting marketing signature, not a replacement app/installer logo. No artwork generated or UI placement changed before approval.

## Roadmap status at this checkpoint

1. Rail/import island: implemented and checked; not newly released.
2. Glass controls: implemented shared-control/navigation foundation and tested accessibility overrides; not a claim every control or physical device has been audited. Static dithercn progress, material preview and Board empty-state shipped in branch; image/website treatments pending.
3. Board: usable first local note/reference workspace, persistence/conflicts/recovery, outline/search/positions/zoom/undo. Missing attachment/PDF rendering, direct manipulation, rich text/drawings/shapes/connectors/frames and full backup import.
4. Board-to-session: not implemented; model choice/confirmation requirements unchanged.
5. MultiAgent replacing active Council: not implemented.
6. Teams hosting/join/roles: not implemented.
7. Collaborative Board and Teams-only BackChat: not implemented.
8. Website rebuild and interactive isolated demo: not implemented. Existing selected brand/fonts are preparation, not the new website.

Latest implementation commit 8eadfe9; public release remains v1.10.2. Technical/browser checks do not imply native installation, screen-reader certification or physical-device coverage. Historical r32 suite has five already-obsolete UI assertions, documented in board-foundation.md; not suppressed.

Recommended short detour after approval: Trace integration + optional SN Pro comparison + marketing tag exports, then resume Board attachments/PDF and canvas editing. Do not expand this into cloning all shortlisted applications.
