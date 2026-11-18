# Native Studio — identity and typography review

This includes the identity review and first integration checkpoint of the approved Native Studio proposal, not the completed
ResearchEngine redesign. Run `python3 -m http.server 4310 --bind 0.0.0.0
--directory design/native-studio` from the repository root, then open port 4310.
No frontend dependencies are needed to serve the review.

## Delivered

- The user-selected generated concept is `logo-concept.png`.
- `assets/symbol.svg`: editable vector interpretation, manually drawn geometric
  path, not a raster wrapper or automatic trace. The silhouette deliberately
  simplifies the selected concept; it is not an exact reproduction.
- `assets/lockup.svg`: matching symbol plus ResearchEngine wordmark. Lettering
  is outlined Bricolage Grotesque, so it does not need an installed font.
- Dark-background and one-colour versions: `symbol-light.svg`, `symbol-dark.svg`,
  `lockup-dark.svg`, `lockup-mono.svg`.
- `assets/app-icon.svg`: rounded-square material study; not yet a replacement
  Windows ICO, Tauri icon set, or installer resource.
- Transparent PNG exports: `symbol.png`, `lockup.png`, `app-icon.png`.
- `index.html`: locally hosted Allo/Work Sans comparison with identical settings,
  chat, filename, numeral and Indonesian text fixtures; light/dark and size
  controls; a separately labelled static shell-layout study; original CSS
  gradient study. The diagram's navigation bar is a placement illustration,
  not Glisse. Product integration will continue to use actual installed Glisse.
- Rendered evidence: `review-desktop.png`, `type-paper.png`, `review-narrow.png`,
  `review-zoom.png`. No screenshot is offered as native app performance evidence.

## Identity usage — draft specifications

Symbol source viewBox: 176 × 184. Maintain aspect ratio; no stretching, rotation,
added outlines or new internal effects. Start with 24px height in the shell;
16px is a recognisability test, not a proven final favicon. Use the monochrome
variant for low-emphasis chrome and the blue mark for identity moments.

Minimum draft clear space around symbol: 24 source units (roughly 1/7 width).
Around the lockup: at least half the symbol's displayed width. Use symbol-only
when the wordmark cannot remain legible; initial lockup floor 180px wide needs
in-app review before finalising. Keep monochrome silhouette separate from the
blue tile's dimensional treatment. Optical corrections and native icon exports
are follow-on work. This is original design development, not trademark clearance.

## Fonts and provenance

Files obtained through published npm archives with scripts disabled, without
adding app runtime dependencies. Original SIL OFL licences are retained in
`fonts/`; font binaries are unmodified. FaceTypes was the discovery catalogue.
Allo's official source was then checked at https://allo.joshpuckett.me/ and links
to https://github.com/joshpuckett/allo.

| npm package | Version | File included |
| --- | --- | --- |
| allo-font | 1.0.3 | AlloVariable.woff2 |
| @fontsource-variable/work-sans | 5.3.0 | work-sans-latin-wght-normal.woff2 |
| @fontsource-variable/bricolage-grotesque | 5.3.0 | bricolage-grotesque-latin-standard-normal.woff2 |

Archive integrity values:

- Allo: `sha512-h1u1ukonlmfTYSRc+MPvrjJU/p12A5xmzXIw5YQXf1/VGNi00cnPJfTf1AxYZOHzXRxK2pBLV7GgxtOm7/f+DQ==`
- Work Sans: `sha512-le8h/OIIuhm5Z7TdvuMw0yKg2gaCZUiMec8zaumsVVjzeJRBPEF0bQI/MkaZDHCVzZDvZoP/O2LiGOSfDLSbaw==`
- Bricolage: `sha512-TLi9Q4hJjS2UvoTMRSS2nHu6c4R56lAw60NR9QYtVRCHn0XtsFpiEhNffZ8Glsoxu6wEEwLKBP8lb94J52PNBA==`

`build-assets.py` regenerates the SVGs with Python fontTools + brotli. No installer
is embedded or executed by the review. Third-party templates/Grainient assets
are not bundled. The gradient is original CSS.

## Verification completed

Chromium headless, sandbox enabled, isolated browser, local HTTP fixture review:
all three font families loaded; light/dark control changes both panels; size
control changes computed type size; labelled switch toggles; no horizontal
page overflow at 390px or at desktop 200% CSS zoom; no page errors. SVG files
loaded and exported to transparent PNG with Canvas. Desktop and narrow renders
inspected. Font cmap inspection confirms glyph coverage of the displayed
Indonesian sample and numerals, not every language or script.

CSS zoom is an overflow probe, not full browser-zoom/assistive-tech certification.
No physical/native WebView, screen-reader, colour-calibrated display, logo
trademark search, or application-wide build/60fps test was performed in this
phase. The existing cold-settings performance limitation remains open.

## Next phase

Apply the reviewed type and chosen identity through existing shared entry
points; consolidate native control styling and actual Glisse/status separation,
then compare real populated application screens. Preserve saved preferences,
chat/editor exclusions, accessible switch semantics and third-party credits.
Do not mass-stage the pre-existing dirty workspace: phase-1 work is confined to
`design/native-studio/` and its proposal documentation.

## Integration update

The selected identity, local fonts, compact controls and shared surface changes
are now integrated in the application. See docs/design/native-studio-integration.md
and the integration-*.png production renders. The live application preview uses
port 3847; this design review remains on 4310. New installer assets/macros are
configured but not yet Windows-build/interaction verified. No release was made.
