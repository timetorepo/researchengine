# Research Engine design comparison

Approved first-step prototype only. **Not imported into the app, its routes,
settings, release build or Teams.** Does not read workspace data. Start from the
repository's normal installed dependencies, then:

```sh
npm ci --prefix tools/design-comparison --ignore-scripts
npm run dev --prefix tools/design-comparison
# http://localhost:5180 (binds 0.0.0.0 for Arena preview)
npm run typecheck --prefix tools/design-comparison
npm run build --prefix tools/design-comparison
```

This intentionally reuses React/Motion/lucide/Inter/Vite/TypeScript from the root
installation. Additional prototype-only dependencies are in this directory's
manifest/lockfile, not the production workspaces. Use the Vite origin shown by
Arena; there are no browser-facing localhost API calls. No proxy/backend.

## What to try

- Workspace toggle: opening **and closing**, including mid-flight reversal.
  Transform/opacity only; desktop layout changes once, not a width tween.
- Narrow viewport: modal overlay, Escape, focus return and section selection.
- Populated/empty/error sample content; no artificial activity/progress.
- Enable Waves trial, then Preview clay/stone. Opt-in lazy module; synthetic
  bounded content only, `prewarm=false`, `live=false`, resolution 1. Controls are
  outside capture. Actual setting changes are never tied to animation completion.
- Motion off / OS reduced motion: no mounted Waves or snapshot. Hidden document
  unmounts it too. WebGL unavailable/context loss/import error leaves plain
  colour switching available. Colour changes remain immediate and real.
- Inter neutral reference, Geist Rounded shell, Newsreader heading accent;
  Lilex code with ligatures off initially. This is not a reading of the user's
  current font preference. No font is applied to the production app.
- Light/opaque toggles, plus OS reduced transparency. These controls are memory
  only, resetting on reload. The prototype's tinted sidebar material is modest;
  it is not a new glass/refraction implementation.

## Verification

```sh
BROWSER_EXECUTABLE=/path/to/chromium node tools/design/check-design-comparison.mjs
```

Uses the isolated Playwright installation in `tools/design`; screenshots go to
ignored `.cache/design-comparison/`. Executed in sandbox Chromium: desktop and
390px mobile render, sidebar hide/inert/open/rapid toggles, mobile Escape/focus
return and section close, populated/empty/error, font/ligature switching,
opt-in actual Waves canvas, motion-off unmount, light/opaque, system reduced
motion, 200%-equivalent layout/text scaling without horizontal overflow,
WebGL-disabled fallback and synthetic context-loss event. Desktop test detected
no external requests, console page errors, localStorage or sessionStorage writes.
Screenshots inspected; this is browser emulation, not a physical device test.

Prototype typecheck/build pass. Measured isolated build: Waves lazy JS chunk
75.21 KB / **27.80 KB gzip**, main JS ~367.5 KB / ~116.6 KB gzip, CSS ~21.72 KB /
~4.21 KB gzip. Font assets separate. These are prototype build sizes, **not** an
app bundle delta, network timings, frame-time results or device guarantees.
Build emits existing Motion `use client` directive warnings (ignored by Vite).

Outstanding before production adoption: actual reference video/interactive
review, screen-reader testing, true browser zoom/OS font scaling, full contrast/
target-size audit, physical hardware, frame-time and memory profiling, real
context loss/capture fault testing, and integration with production preferences.
The small editorial specimen is not a production density/accessibility baseline.
No deployment/release. Production adoption needs the next review decision.

## Provenance / licences

- Waves 0.1.0, MIT: supplemental package pinned with npm integrity. Audit notes:
  `docs/design/waves-and-editorial-proposal.md`. Licence copied to public/licenses.
- Geist Rounded variable WOFF2 from `mishanaer/geist-rounded` commit
  `3e41554b9f24bb358fc2ac26a52a3a2fc4df138f`,
  `webfonts/GeistRounded[wght].woff2`. OFL text alongside font.
  Font SHA256: `7ed429cf57106465eadbf1d8a6d4a73d975ff64f892d1e3f93f392f80a20c9a7`.
  Licence SHA256 (trailing whitespace normalized): `e8ac56ff65a188078ae4aa5215d640539026a3511b31ea7c8adf18647783a96c`.
- Newsreader / Lilex: Fontsource Variable 5.3.0 pinned with npm integrity;
  included OFL notices copied to public/licenses. Fontsource package metadata
  records upstream project origin. SHA256 inventories below cover exact bundled
  package WOFF2 files; generated app output stays ignored.
- Inter: existing repository Fontsource dependency, OFL notice retained.
- Existing Research Engine symbol copied unchanged from frontend/public/brand;
  no new logo is proposed. Original comparison composition; no reference-site
  imagery/assets or proprietary fonts copied. Icons: existing lucide-react.

Font inventory: `font-sha256.txt` (paths relative to this directory).

## Home artwork follow-up

User confirmed the supplied Grainient image came from freebies. Added an
integrated static Home welcome-card placement before the navigation sample, with
artwork toggle, safe text scrim, real same-page comparison links and solid
image-error fallback. Local optimised derivative: 1280×720 / 8,792 bytes;
raw 2.5 MB PNG not committed. Attribution/rights/hash:
`public/art/README.md`. Freebie does not mean public domain or open source.

Added browser checks for image decode, decorative alt, artwork toggle, navigation
link target and blocked-image fallback. Desktop/mobile card screenshots inspected.
Existing full comparison tests/typecheck/build pass. Updated isolated main JS:
369.42 KB / 117.09 KB gzip; CSS 23.74 KB / 4.72 KB gzip. Waves unchanged. No
production Home, Teams, theme settings or MCP configuration changes.
