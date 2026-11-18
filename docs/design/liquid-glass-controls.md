# Liquid Glass controls — implementation checkpoint

Not a release note. No version or release changed.

The saved Appearance > Liquid Glass Redesign setting defaults off when absent. It is independent of colour, layout and navigation settings. Actual installed Glisse 0.5.0 components now back the shared HeroUI-style Switch, Button and Input adapters and the native segmented adapter when enabled. Segments with disabled items keep native radio controls because this library version lacks per-item disable support. Existing Base UI popup semantics remain intact; selected interface surfaces receive opt-in styling, not reading/editor backgrounds.

System reduced motion, reduced transparency and forced colours, plus the app's reduced-motion setting and High Contrast theme, temporarily override the saved request. They do not erase it. Standard controls are used instead of trying to stop Glisse JavaScript springs with CSS. Higher GPU/battery cost is disclosed beside the setting.

## Static dithercn source

Reviewed opencoredev/dithercn at 3b1e85384c9ab05d381612d5520342dc38809adb, MIT. Source-owned pattern, matrix, palette-token and generated blue-noise modules are included under frontend/src/lib/dither; licence in docs/licenses/dithercn-MIT.txt. One compatibility adaptation replaces Object.hasOwn with Object.prototype.hasOwnProperty.call for this project's TypeScript target. These provide static SVG masks for measured linear progress and Appearance material swatches. No WebGL/canvas/animation loop; no fabricated progress. Image and website treatments remain future work.

## Verified

- TypeScript, frontend/backend production build, 12 BoardUI adapter checks: pass.
- tools/design/check-liquid-glass.mjs, headless Chromium: default off, Space toggling, reload persistence, actual Glisse switch keyboard change, disabled switch/actions, loading disable, controlled password edits and visibility, native disabled-segment fallback, OS/app reduced motion, forced-colour override and restoration: pass.
- Inspected desktop adapter screenshot. Corrected inherited Glisse input max-width afterwards; TypeScript/build passed after correction.

## Remaining scope / limits

This is a shared-control foundation, not a claim that every app control has been migrated. Broader feature-by-feature control and keyboard audits, navigation accessibility and selected image/empty-state treatments still need work before declaring the redesign milestone complete. Existing experimental tab-bar opt-in remains separate. No screen-reader, physical GPU/battery, native installer or physical-device testing. Reduced-transparency is implemented with matchMedia but was not independently browser-emulated in this check. Website/image dithering is not yet implemented.

## Second checkpoint: range/search and palette integration

- Shared Slider retains an actual range input in both native and Glisse branches. Appearance, workspace width, model tuning, flow pacing, agent budget and UI Lab ranges use it; no synthetic change events or altered bounds. Added missing pacing/UI Lab accessible names.
- Shared SearchField now powers settings search with actual Glisse search and clear behaviour while preserving native fallback, bounded query and accessible name.
- Popup fill is 96% app surface for legibility; Base UI retains Escape, focus restoration and modality. Added visible Glisse input/range focus outlines.
- Derived secondary Glisse materials from app tokens rather than OS colour scheme, including named palettes.
- Extended browser checks pass for range ArrowRight/End, disabled range, actual settings range increments, settings search clear, popup Escape/focus restoration, 390px and 1280px settings horizontal bounds, matching input ink across light/Latte/Nord/dark and app High Contrast fallback. Inspected desktop/narrow settings and Latte/Nord control renders; theme screenshots disable transition animations to capture settled colours.
- Settings-search regression suite, TypeScript, production frontend/backend build, 12 BoardUI adapter checks and diff whitespace check pass after changes.
- 390px is viewport emulation, not a phone test. No exhaustive contrast certification, screen-reader test or 200% browser zoom test yet.

## Navigation accessibility follow-through

The independent experimental floating tab bar and Coding section switch now use real route links with aria-current under OS reduced motion/transparency, forced colours, app reduced motion or the High Contrast theme. Saved opt-ins remain unchanged. This bypasses Glisse JavaScript springs, not only CSS animations. Static destinations have visible focus, opaque surfaces and forced-colour selection outlines.

Browser checks in check-board-storage.mjs verified link rendering, Enter navigation to Coding, Coding section links, 390px floating bounds and forced-colour fallback. Existing glass and settings-search browser suites also pass. These checks do not claim screen-reader or physical-device coverage.
