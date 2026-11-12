# Workspace layouts and history — 2026-11-12

## Implemented

- Appearance → Workspace layout: Focused, Overview, Studio, stored separately from colour themes. Unknown/older values fall back to Focused.
- Overview Home adds pinned/recent conversations with real local titles, dates and direct resume actions. Empty state explains how to begin. No invented attention scores or fake activity.
- Studio adds the same supporting work component on desktop browsing routes (Home, Chats, Library, coding projects, workflow index). Hidden below 1280px and not mounted in active chat, Codersa, settings, nested workflow routes or the embedded coding workbench. ResearchEngineOS retains its Dock/layout.
- Desktop sidebar resize: pointer drag, Left/Right (8px), Home/End (216–360px), double-click reset (248px), accessible separator and Appearance slider. Pointer movement is local transient state; save only on release. Cancel/unmount removes listeners.
- Nine secondary tools can be pinned into primary navigation from Appearance. Unpinned tools stay accessible through More tools; primary destinations cannot be removed. Width and pins use existing scoped settings persistence.
- Chats defaults to Pinned/Recent list; detailed research/coding table remains selectable both on the page and in Appearance. All/Research/Coding filters retained; metadata subordinate in list; isolation/actions remain available on narrow screens. Rename input no longer nested inside a navigation button. Escape cancels without saving. Row menus no longer clipped by section overflow.
- Compact/Comfortable continues using the existing compact preference. Fresh profiles now start compact; persisted false remains comfortable. List rows have measured different heights. No second density system.
- Existing glass modes exposed as Solid/Frosted/Refractive; floating Glisse material now follows that preference, with separate 0–100 strength controlling its backdrop opacity and blur. Solid/reduced-transparency/unsupported-filter fallbacks. Reading surfaces are not made glass. Lens remains transparent in Solid mode so selected labels are visible.
- New settings use existing HeroUI switch, Apple grouped surfaces, ModernSelect, Motion and Glisse. No production dependencies. Appearance update patches are now typed. Copy no longer claims unmeasured scrolling smoothness or incorrectly hides Glisse on all coding screens.
- Shell and history respect both the stored reduced-motion setting and Motion's operating-system preference. Reduced-motion history uses existing plain HeroUI tabs rather than gooey tabs.

## Verification

- `npx tsc --noEmit -p frontend/tsconfig.json`: passed.
- `npm run build`: frontend and backend passed; frontend 40.77 seconds in this sandbox. Existing dynamic-import/mixed-import/large-chunk warnings remain. This is build timing, not an app speed benchmark.
- 21 Node tests: navigation policy and workspace preference bounds/fallback/Studio exclusions passed.
- `tools/design/check-workspace.mjs`: isolated sandboxed Chromium passed layout/pin/width persistence, pointer and keyboard resize, populated Overview, Pinned/Recent list/table, kind filter, measured density row-height difference, rename Enter/Escape, computed frosted blur vs solid no-filter, transparent selected lens, Studio exclusion in active chat, 390/320px no document overflow and empty states. No page errors.
- Existing `check-shell.mjs` and `check-settings.mjs` passed after these changes: navigation, Glisse clearance/centering, mobile drawer and tools Escape/focus, collapse persistence, coding bar policy, switch geometry/click/Space/reload.
- Reviewed screenshots: populated Overview Home, Studio history and 320px history. Found and corrected selected-label occlusion caused by applying an opaque background to Glisse's upper lens. Latest screenshots are ignored development artifacts in `.cache/workspace-review/`.
- Chromium uses `LD_LIBRARY_PATH=/tmp/al2023/lib BROWSER_EXECUTABLE=/tmp/chromium`; scripts require tools/design dependencies and a compatible sandboxed browser. Dev-server source imports seed only isolated test profiles. Restart Vite before tests after changing store modules to avoid HMR timestamp versions creating duplicate test imports.

## Deliberately not claimed complete

- This is not an exhaustive audit of every Settings tab/toggle, failed-save path or third-party animation. No blanket claim that all reported broken settings are fixed.
- No new fractal shader, continuously animated distortion, expressive-motion preset, font replacement or typography sample comparison. Existing Refractive mode is reused, not a newly implemented renderer.
- Home's existing suggestion, streak and optional widget features are preserved; this is not a wholesale composer/active-conversation redesign.
- No large-history performance profile, physical device, screen-reader, 200% zoom, Windows/Tauri installer, release or deployment testing. Studio embedded-workbench exclusion also has policy/unit coverage, not an actual project-opening end-to-end test.
- Reduced-transparency/unsupported-filter fallback styles inspected in code; not all browser-engine combinations emulated. Refraction fidelity and frame rate on real hardware remain unmeasured.
