# Screen: Library

Job: find anything you already have, in ≤ 10 ms for indexed content.

Mobile file: `mobile/src/screens/Library.tsx`. Desktop ancestor:
`frontend/src/components/library/LibraryView.tsx` (tabs `citations | knowledge |
spaces`) plus `/chats` and documents from the store.

## Anatomy

1. Search field, top zone (sanctioned per `03` §2), 44 h, always focused-on-tap;
   lanes shown under it while typing: `Documents · Citations · Knowledge ·
   Notebooks` (the four store collections: documents, citations, knowledge cards,
   spaces) with per-lane hit counts; local query tier-1.
2. Section list (not segmented control; 200%-text rule from `02` §3): Recent
   documents, Citations (with `collection` grouping), Knowledge cards (tags
   visible), Notebooks (space name + chat count).
3. Row anatomy 56–68 pt: kind glyph, title (Headline 1 line), meta line (Caption,
   ` · ` separated), chevron-free; long-press sheet: Open / Add to notebook /
   Quiz this / Export / Delete (destructive last, red).
4. Import action: sheet from Ask row "Add files" (camera / photos / files) →
   `re-fs` pipeline (R4); until R4 the row exists with the honest state copy from
   `../09-states.md`.

## States

Empty: "Your library is where everything you read lands. [Add a file] [Start a
chat and save sources]". Offline: fully functional by definition (local index);
the search field placeholder swaps to "Searching your library (offline)".
Indexing progress (post-import): one JobRow under the header, "Indexing 1,204
documents · 60 %" + cancel. No spinner on results.
Error (corrupt file): row-level, "Couldn't read {name} · why()" style with the
extractor's message (the repo's convention: surface the real error verbatim,
`index.ts onError`).

## Measurements, motion, tiers

Gutter 16; lane chips 28 h pill; skeleton rows 56 h. Scroll: virtualized
(10 000-item `LibraryScroll` scene budget). Type = transform on list, no
layout animation. Query → results: tier-1 (≤ 8.3 ms for indexed hits,
`../11-latency.md`); opening a doc page cached: tier-1; fetch-on-demand from
companion for non-synced files: tier-2 with 400 ms sentence.
