# Native Studio — integration checkpoint

## Implemented in the real application

- Locally served Allo variable font and Work Sans comparison option, with bundled
  SIL OFL licences. New profiles choose Allo. Existing saved typeface IDs and
  editor preferences are preserved; existing users can choose Allo in Appearance.
- Bricolage brand type, selected original geometric logo and outlined wordmark
  assets; shared React BrandMark geometry in sidebar/app logo, Welcome,
  onboarding, assistant avatar, restore control and trace loader. Intro and
  installation-film assets now resolve to the same identity. About and PWA
  branding updated, with local font licences and credits.
- Warm graphite default-dark tokens with a lighter readable accent and secondary
  ink; other colour themes and custom palettes remain separate from layout.
- Shared compact platform-like switches with controlled state, native button
  Space/Enter/label behaviour, disabled state, focus, reduced-motion handling,
  forced-colour support and existing geometry slots retained for tests.
- Native radio segmented control for density; keyboard-operable text-size slider;
  compact shared buttons/input/select presentation. Input labels/descriptions and
  invalid state are associated explicitly rather than nesting actions in a label.
- Settings grouped rows and restrained rail selection; no decorative banner
  before Appearance controls. Existing real settings behaviour remains.
- Actual installed Glisse navigation retained, opt-in/saved material/clearance
  policy intact. Status stays separate. Activity capsule width changes are now
  immediate on deliberate expansion, not an animated per-frame layout change.
- Removed unconditional WebGL waves behind Home/chat; Home uses an original still
  light field. User-selected backgrounds and optional effects remain available.
- Fixed the collapsed sidebar's notification control nesting a button in a button.
- Intro respects app/system reduced motion with a static selected mark and shorter
  hold, rather than mounting the animated shader in that mode. Full first-launch
  animated intro remains available and still has the performance limit below.

These shared changes reach existing Library, Marketplace, Calendar, notification,
update, questionnaire and agent-log consumers; they are not 24 new independent
third-party packages. The proposal's 24 entries are reference candidates, not a
claim that every theatrical reference was copied or integrated. No Uberdesigner
prompt/source or unlicensed Grainient download is bundled. Optional individual
widget refinements still need their own real-workflow review rather than fake
statistics, autoplay or unrelated feature additions.

## Installer work (after the first integration/regression pass)

The selected identity is now exported to desktop PNG/ICO/ICNS variants, installer
and uninstaller icons and PWA artwork. The Windows NSIS configuration uses an
original sidebar/header and custom Welcome/Finish copy through Tauri's existing
include mechanism. Launch/desktop shortcut are opt-in. Maintained per-user,
upgrade, uninstall and WebView2 logic is unchanged. See desktop/installer/README.md.
This is a polished branded native wizard, not a replacement installer engine.

## Verification

- TypeScript: passed after the final reduced-motion intro change.
- Root production build passed after the final intro change (frontend 47.16s;
  backend bundle passed). Existing dynamic-import/large-chunk warnings remain.
- Kit checks: 15 pass; BoardUI checks: 12 pass.
- Browser check-native-studio: actual Glisse, local Allo, no nested buttons,
  radio arrow keys, compact switch/Space, existing named-font selection,
  390px/200% CSS-zoom overflow probes, active-chat clearance and no unconditional
  PatternWaves import: passed, no page errors.
- Existing check-settings, check-shell, check-boardui, check-boardui-data and
  check-image-crop: passed. Workspace and Bencho browser checks each hit an
  immediate-state assertion once, then passed unchanged on rerun; this is not a
  stability certification. No assertions were removed to obtain a pass.
- Native asset checks: shared mark, file references, BMP dimensions/24-bit format,
  PNG RGBA, multiple ICO sizes, explicit launch and unchanged per-user/WebView2
  modes: pass. Local Tauri CLI schema property/type probe passed in legacy-regex
  mode; this does not replace Rust/NSIS compilation.
- Desktop structural check: 32 pass, one failure because this workspace has no
  locally compiled sidecar. The new installer has not yet been compiled/run in
  Windows CI. Prior v1.9.0 success is not evidence for these new changes.
- Actual desktop shell/settings/chat screenshots inspected; branded production
  screenshots are in design/native-studio/integration-app.png,
  integration-settings.png and integration-narrow.png. A production browser
  probe confirmed the reduced-motion intro uses a static image, mounts no intro
  canvas and dismisses normally. Physical devices, native installer interaction, upgrade/uninstall,
  screen readers and true browser zoom remain unverified.

## Performance correction and unresolved work

The earlier cold-settings scenario also included a previously-unseen launch
intro. In the harness, the Settings button exists behind the intro, but Playwright
waits for the intro to stop intercepting the click. Sampling had already started,
so the GPU-heavy logo animation was included. Do not erase that first-launch
experience or retrospectively claim it never mattered.

Current first-launch-inclusive report (Chromium 153, 1440×1000, production,
motion on, no throttle, mocked services) is retained in
`native-studio-first-launch-performance.json`: settings-first-open p95 216.6ms,
26 long tasks, max 240ms. Trace inspection showed GPU/Commit stalls.

The harness now has an explicit **NATIVE_PERF_SKIP_INTRO=1** mode, representing
an existing user with the intro already seen. It does not warm settings chunks.
`native-studio-isolated-ui-performance.json` records that separate scenario:

| Isolated scenario | p95 frame interval | Max frame interval | Long tasks |
| --- | ---: | ---: | ---: |
| First settings open | 16.8ms | 50ms | 1, max 50ms |
| Profile tab | 16.8ms | 33.3ms | 0 |
| Warm settings open/close | 33.3ms | 33.4ms | 1, max 51ms |
| Marketplace filter drawer | 16.8ms | 16.8ms | 0 |
| 1,000-file tree keyboard scroll | 33.3ms | 50ms | 0 |

These samples contain action time and a short idle tail. They do not establish
physical-device FPS or universal 60fps. The full intro and some warm/tree frames
still miss the target. Next performance work should isolate intro shader cost
and compare physical/native rendering, not simply add will-change or hide slow
samples. The static reduced-motion intro is an accessibility fix, not evidence
that the full-motion shader was optimised.

## Repository and release boundary

Existing dirty workspace changes were preserved; no mass-stage, overwrite,
branch switch or new release was performed. No previously-published release
asset was replaced. New branding needs Windows installer compile/interaction
verification before it should be described as release-ready.

A production preview is running on port 3847 with an isolated local preview data
directory/database under .cache. It is not a deployment or the user's existing
installation. No model credentials or external-service connection was seeded.
