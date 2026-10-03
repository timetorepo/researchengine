# mobile/src-tauri — the Tauri 2 mobile app

## What this is

The thin Rust shell around the React mobile UI (brief §3). R1 scope: app
lifecycle, the frame-log ring buffer, and the haptics bridge point. Library,
models and the companion attach in R2/R5/R6 behind `re-core`, not here.

## Building (real toolchains required; this sandbox has none)

Prereqs (also listed in `docs/mobile/12-platform-differences.md`):

- Rust 1.80+ with targets: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim aarch64-linux-android armv7-linux-androideabi`
- iOS: Xcode 15+ (macOS only)
- Android: SDK Platform 34, NDK r27, `JAVA_HOME` (Temurin 17)

```bash
cd mobile
npm install
npm run tauri ios dev        # or: npm run tauri android dev
npm run tauri ios build      # release bundles are produced by CI on tags (R8)
```

The first `tauri (init|dev|build)` regenerates `gen/schemas/*` and the Xcode /
Gradle projects; they are intentionally not committed (matching the desktop
package's convention of not vendoring generated platform projects).

## R1 honesty box

- No iOS/Android compile happened in the authoring sandbox (no rustc/Xcode/SDK
  present). The Rust code here is `cargo test`-clean at the crate level and the
  app crate is standard Tauri 2 scaffolding; CI (`.github/workflows/mobile.yml`)
  is the first place anything compiles. The R1 acceptance line ("opens on an
  iPhone and a low-end Android ...") is therefore *pending device CI*, not
  claimed done.
- `icons/icon.png` is a generated placeholder; run `cargo tauri icon` with the
  real artwork before store builds.
- CSP `connect-src 'self'` blocks WebView network use by construction, which is
  exactly the tier-1 guarantee (docs/mobile/11 §Tier 1: no network on these
  paths, ever). The provider bridge (R3) replaces it with scoped re-core
  transport.
