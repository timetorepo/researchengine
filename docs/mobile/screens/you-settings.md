# Screen: You (profile + all settings)

Job: make every preference reachable and every posture visible, with the theme
engine as its centrepiece (R1 ships this screen for real).

Mobile file: `mobile/src/screens/You.tsx`. Desktop ancestors:
`settings/AppearanceTab.tsx` (themes, glass modes `off|liquid|blur`),
`settings/ProvidersTab.tsx` (keys incl. image/voice keys), `settings/FlowTab.tsx`
(shaping modes), `settings/PerformanceTab.tsx` (profiles, resources),
`settings/DataTab.tsx` (ZIP export/import, JSZip), `settings/AboutTab.tsx`,
`sidebar/PrivacyPanel.tsx` (shield), `settings/SearchTab.tsx`, `SkillsTab`,
`AgentsTab`, `CodingTab`, `IntegrationsTab`, `ShortcutsTab`.

## Rows (order fixed; sections are list rows per 200% rule)

1. Profile: `profileName` editable (Caption label "Shown in the greeting").
2. Appearance: theme grid 2 columns, ThemeCard = swatch strip (4 from
   `meta.ts` swatches) + name + caption line (THEME_CAPTIONS), selected ring
   `brand` 2px; favourites row = `themeFavorites`; below: Surface segment
   (Glass off/Liquid/Blur → on mobile Liquid = Full-ladder only, per
   `01` §4), Text size (OS link-out), Density, Reduce motion.
3. Privacy Shield: three postures with `shield.ts` descriptions (their exact
   wording is user-facing already; reuse, not rewrite); connection log entry.
4. Providers: 11 entries from `registry.ts` via `@re/types`; key state =
   "saved/none", test button → `/api/providers/test` equivalent local; Free-
   demo row pinned top with honest copy (parity §1).
5. Search: backend select (demo|searxng|brave|serper|tavily|ddg), SearXNG url,
   region.
6. Models (R5): size classes Quick/Balanced/Deep in plain words, storage figure,
   download/pause/delete, cellular setting.
7. Companion (R6): status line, scopes (ScopeRow), pair/forget.
8. Notifications: master switch off by default + per-type rows (flood done,
   export done, study timer).
9. Data: Export ZIP / Import ZIP (store-scoped today per parity §1; folder-scoped
   when R2 lands — the row says which format you're getting).
10. Advanced: Performance (ladder readout: level, median ms, thermal state,
    "why"), export frame log (JSON), storage, clear cache, Developer: design
    preview link (dev builds only, `?design=1`).
11. About: version string (single source, see `01` §0 drift note), maker line,
    component credits (README's "shoulders of" list), license text *as the
    repository has it* (all-rights-reserved until R9 fixes the license question
    raised in parity §0).

## States & tiers

Every control is tier-1 (repaint ≤ 8.3 ms); theme switch tested in R1
(`mobile/scripts/test.mts`). Search-a-provider action = tier-2. Nothing on this
screen may grey out: unshipped features (models until R5, companion until R6)
render the `../09-states.md` "coming in this app's later rounds, here's what it
will do" state, never a dead switch.
