# Trace, optional SN Pro and marketing signature

Implementation checkpoint, not a release note. User approved continuing after the fonts/Trace/tag proposal. No provider calls or new application dependency were required.

## Actual SortUI integration

Public MIT Trace and Collapsible source is vendored from sortui/ui at 664a42e05aef13fee59c8da5209eef3ef9a84d4f. Licence, copyright and adaptation manifest are in components/ui/sortui. Installed clsx and Base UI are reused; no registry CLI or Pro content.

The existing chat ToolTraceChips call site now renders ActivityTrace. BoardTaskList remains a compatibility adapter to the same presentation. Modern ToolActivity takes precedence; legacy toolTrace renders all recorded events rather than only the last six. Saved messages are not migrated/rewritten. Duplicate legacy entries are not deduplicated because identical labels may describe separate operations. Modern/legacy arrays are not combined into duplicate receipts. The Bird's-eye legacy action remains available; approval/questionnaire components are unchanged.

Status is explicit, with expandable metadata, recorded non-negative finite durations and unknown-duration text when absent. There is no elapsed-time timer, inferred stream-completion success, raw output, tool argument dump or new reasoning display. Existing stored resource/label strings are rendered as text, not fetched or interpreted as HTML. This view is not a new security scrubber for arbitrary old metadata and does not add execution events that were never recorded. Existing event schemas do not yet carry rich subagent/source trees; MultiAgent is still future work.

App palette mappings, long-name wrapping and reduced-motion overrides adapt the upstream visuals. Browser testing found that the app-wide keyboard-mode flag ignored Tab; Tab and Shift+Tab now restore visible focus in addition to arrow navigation.

## Font

SN Pro is a new optional saved Typeface choice; no existing default/saved choice is replaced. Normal/italic variable weights 200–900 are self-hosted, approximately 256 KB combined. Official font source pinned at e025ac4755352167a4b160bfb77c72068b04b55c; OFL and conversion provenance alongside font files. Development-only fontTools/brotli converted upstream variable TTF to WOFF2; no new runtime dependency. Cera Round and NDot were not bundled.

## Tag deliverables

Original production signature at design/marketing/tag, graphite and warm-paper standalone SVG/PNG exports, 1600 × 1200. Existing selected app symbol; outlined Geist Mono lettering with OFL notice. No Acre mark, private coordinates, fake domain or registered-trademark claim. RE 01 means artwork edition, not app version. No generated-image model or copied reference artwork. tools/design/make-brand-tag.py recreates the outlined SVGs; browser test rasterizes them. No website or installer placement changed.

## Verification

Passed:
- TypeScript and production frontend/backend build.
- 16 BoardUI/Trace adapter checks, including legacy completeness, modern precedence, invalid/zero durations and empty trace.
- check-trace-font-tag.mjs: actual Trace at the existing tool UI call site, seven statuses, 12 legacy events, recorded/unknown durations, keyboard disclosure, graph callback, narrow wrapping, OS/app reduced motion, forced-colour keyboard focus, actual settings SN Pro selection, normal/italic font loads and saved preference reload. Reasoning/raw-output canary fields not rendered. Fixtures are explicitly labelled synthetic, not live provider results.
- Existing Board workspace/storage, glass-control and settings-search browser regression scripts.
- Inspected desktop/narrow Trace renders and graphite tag; both tag PNGs rendered successfully. Whitespace diff check clean.

No native-install/device, screen-reader, exhaustive contrast or live Gemini/provider integration claim. Existing documented historical r32 source-assertion failures were not suppressed. No version bump or release. Continue next with the previously approved Board attachment/PDF and canvas work.
