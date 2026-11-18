# Native Studio installer presentation

Keeps Tauri's maintained NSIS install/upgrade/maintenance/uninstall and WebView2
bootstrap logic. No full-template fork, third-party theme plugin, new installer
framework, extra shell command, data-deletion hook or fake progress timer.

## Changes

- Shared selected identity in Windows setup/uninstaller icons, app/taskbar icons,
  shortcuts, Linux bundle icon and PWA assets.
- Original ultramarine/graphite Welcome/Finish sidebar (`sidebar.bmp`, 164×314,
  24-bit RGB). Original artwork and outlined Allo text live in `sidebar.svg`.
- Original header mark (`header.bmp`, 150×57, 24-bit RGB); uninstaller inherits
  Tauri's header default behaviour. Existing OS theme/contrast remains usable.
- `branding.nsh` overrides MUI welcome/finish copy through the documented
  installerHooks include. No destructive hooks are defined.
- Finish-page launch and desktop shortcut are opt-in, not checked by default.
- Per-user install mode, English language selection, upgrade identity and
  WebView2 missing-runtime handling are unchanged.

This is a branded native Windows wizard, not a custom SwiftUI installer or a
claim that NSIS's stock controls can be completely restyled with a bitmap.
Maintaining familiar location, progress, errors and uninstall behaviour is
intentional. No silent upgrade of the published v1.9.0 assets is performed.

## Rebuilding original artwork

From the repository root, in a developer environment:

1. `python3 scripts/build-native-installer-art.py` (fontTools + brotli)
2. `node scripts/export-native-brand.mjs` (tools/design Playwright and Chromium;
   optional BROWSER_EXECUTABLE)
3. `python3 scripts/build-native-icons.py` (Pillow)
4. `node scripts/check-native-brand.mjs`

These are explicit development tools, not install hooks or new CI prerequisites.
Python packages/browser dependencies are not runtime application dependencies.
Use the checked-in assets for normal desktop builds.

## Verification boundary

Structural checks pass: file references, bitmap dimensions/bit depth, PNG RGBA,
ICO sizes, shared symbol geometry, existing install mode and WebView2 mode.
Installed Tauri CLI JSON schema accepts the added config keys; the local AJV
probe used legacy regex mode because the upstream schema includes escaped
characters incompatible with JS Unicode regexes (it is not a Rust build).

Reviewed the public Tauri installer template at
`crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi`, dev commit
`a12f57d6425fe2e7d8ced3546f4d8a52a54e6640`: hooks are included before page macros,
allowing the MUI presentation definitions without copying the template. The
actual installed bundler must still compile this configuration in CI.

The new branded installer has NOT yet been built/run on Windows. Native compile,
Welcome/Finish text fit, DPI scaling, upgrade, WebView2 failure recovery and
uninstall must be checked before a new release is declared. Prior v1.9.0 CI
success does not certify these new assets/macros.
