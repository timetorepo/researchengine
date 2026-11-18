# Liquid Glass controls — implementation checkpoint

Not a release note. No version or release changed.

The saved Appearance > Liquid Glass Redesign setting defaults off when absent. It is independent of colour, layout and navigation settings. Actual installed Glisse 0.5.0 components now back the shared HeroUI-style Switch, Button and Input adapters and the native segmented adapter when enabled. Segments with disabled items keep native radio controls because this library version lacks per-item disable support. Existing Base UI popup semantics remain intact; selected interface surfaces receive opt-in styling, not reading/editor backgrounds.

System reduced motion, reduced transparency and forced colours, plus the app's reduced-motion setting, temporarily override the saved request. They do not erase it. Standard controls are used instead of trying to stop Glisse JavaScript springs with CSS. Higher GPU/battery cost is disclosed beside the setting.

## Static dithercn source

Reviewed opencoredev/dithercn at 3b1e85384c9ab05d381612d5520342dc38809adb, MIT. Source-owned pattern, matrix, palette-token and generated blue-noise modules are included under frontend/src/lib/dither; licence in docs/licenses/dithercn-MIT.txt. One compatibility adaptation replaces Object.hasOwn with Object.prototype.hasOwnProperty.call for this project's TypeScript target. These provide static SVG masks for measured linear progress and Appearance material swatches. No WebGL/canvas/animation loop; no fabricated progress. Image and website treatments remain future work.

## Verified

- TypeScript, frontend/backend production build, 12 BoardUI adapter checks: pass.
- tools/design/check-liquid-glass.mjs, headless Chromium: default off, Space toggling, reload persistence, actual Glisse switch keyboard change, disabled switch/actions, loading disable, controlled password edits and visibility, native disabled-segment fallback, OS/app reduced motion, forced-colour override and restoration: pass.
- Inspected desktop adapter screenshot. Corrected inherited Glisse input max-width afterwards; TypeScript/build passed after correction.

## Remaining scope / limits

This is a shared-control foundation, not a claim that every app control has been migrated. Sliders, search, tab bars, popup material refinement, populated/narrow-window theme comparisons and broader keyboard audits still need work before declaring the redesign milestone complete. No screen-reader, physical GPU/battery, native installer or physical-device testing. Reduced-transparency is implemented with matchMedia but was not independently browser-emulated in this check. Website/image dithering is not yet implemented.
